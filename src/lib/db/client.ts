import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle as drizzleSqlite, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate as migrateSqlite } from "drizzle-orm/better-sqlite3/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { dialect } from "./dialect";
import type * as schema from "./schema";

type Orm = BetterSQLite3Database<typeof schema>;

type QueryDb = {
  insert: (...args: unknown[]) => object;
  select: (...args: unknown[]) => object;
  selectDistinct: (...args: unknown[]) => object;
  update: (...args: unknown[]) => object;
  delete: (...args: unknown[]) => object;
  transaction: (fn: (tx: QueryDb) => Promise<unknown>) => Promise<unknown>;
};

type Store = {
  orm: QueryDb;
  sqlite?: Database.Database;
  pool?: Pool;
};

type CacheHost = typeof globalThis & { __fudoDb?: Store };

const cache = globalThis as CacheHost;
const lockStore = new AsyncLocalStorage<true>();
const transactionDepth = new AsyncLocalStorage<number>();

let pending: Promise<Store> | undefined;
let migratedInThisModule = false;
let queue: Promise<void> = Promise.resolve();

export type Database = {
  insert: Orm["insert"];
  select: Orm["select"];
  selectDistinct: Orm["selectDistinct"];
  update: Orm["update"];
  delete: Orm["delete"];
  transaction<T>(fn: (tx: Database) => Promise<T>): Promise<T>;
};

function sqliteFilePath(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl?.startsWith("file:")) {
    if (databaseUrl.startsWith("file://")) {
      return decodeURIComponent(new URL(databaseUrl).pathname);
    }
    const relative = databaseUrl.slice("file:".length).replace(/^\.\//, "");
    return path.resolve(process.cwd(), relative);
  }
  return path.resolve(process.cwd(), "data", "fudo.sqlite");
}

function migrationsFolder(): string {
  return path.join(
    process.cwd(),
    "drizzle",
    dialect === "postgres" ? "postgres" : "sqlite",
  );
}

function withSessionLock<T>(fn: () => Promise<T>): Promise<T> {
  if (dialect !== "sqlite" || lockStore.getStore()) {
    return fn();
  }

  const run = queue.then(() => lockStore.run(true, fn));
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function requireStore(): Store {
  const store = cache.__fudoDb;
  if (!store || !migratedInThisModule) {
    throw new Error("Database is not open");
  }
  return store;
}

function databaseFor(orm: QueryDb): Database {
  return new Proxy({} as Database, {
    get(_target, property) {
      if (property === "transaction") {
        return (fn: (tx: Database) => Promise<unknown>) =>
          runTransaction(orm, fn);
      }
      const value = (orm as Record<PropertyKey, unknown>)[property];
      if (typeof value !== "function") return value;
      return (value as (...args: unknown[]) => unknown).bind(orm);
    },
  }) as Database;
}

async function connect(): Promise<Store> {
  if (dialect === "sqlite") {
    const file = sqliteFilePath();
    mkdirSync(path.dirname(file), { recursive: true });
    const sqlite = new Database(file);
    sqlite.pragma("foreign_keys = ON");
    const orm = drizzleSqlite(sqlite);
    return { orm: orm as unknown as QueryDb, sqlite };
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required when DATABASE_DIALECT=postgres");
  }

  const pool = new Pool({ connectionString: url, max: 5 });
  const orm = drizzlePg(pool);
  return { orm: orm as unknown as QueryDb, pool };
}

async function applyMigrations(store: Store): Promise<void> {
  const folder = migrationsFolder();
  if (store.sqlite) {
    migrateSqlite(store.orm as unknown as BetterSQLite3Database, {
      migrationsFolder: folder,
    });
    store.sqlite.pragma("foreign_keys = ON");
    return;
  }
  await migratePg(store.orm as unknown as Parameters<typeof migratePg>[0], {
    migrationsFolder: folder,
  });
}

async function closeStore(store: Store): Promise<void> {
  store.sqlite?.close();
  await store.pool?.end();
}

function boot(): Promise<Store> {
  if (cache.__fudoDb && migratedInThisModule) {
    return Promise.resolve(cache.__fudoDb);
  }
  if (!pending) {
    pending = (async () => {
      const existing = cache.__fudoDb;
      const store = existing ?? (await connect());
      try {
        await applyMigrations(store);
      } catch (error) {
        if (!existing) await closeStore(store);
        throw error;
      }
      cache.__fudoDb = store;
      migratedInThisModule = true;
      return store;
    })().catch((error: unknown) => {
      pending = undefined;
      throw error;
    });
  }
  return pending;
}

async function executeSqliteTransaction<T>(
  sqlite: Database.Database,
  fn: (tx: Database) => Promise<T>,
): Promise<T> {
  const depth = transactionDepth.getStore() ?? 0;
  if (depth === 0) {
    sqlite.exec("BEGIN IMMEDIATE");
    try {
      const result = await transactionDepth.run(1, () => fn(db));
      sqlite.exec("COMMIT");
      return result;
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  }

  const savepoint = `sp_${depth}`;
  sqlite.exec(`SAVEPOINT ${savepoint}`);
  try {
    const result = await transactionDepth.run(depth + 1, () => fn(db));
    sqlite.exec(`RELEASE SAVEPOINT ${savepoint}`);
    return result;
  } catch (error) {
    sqlite.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    throw error;
  }
}

async function runTransaction<T>(
  orm: QueryDb,
  fn: (tx: Database) => Promise<T>,
): Promise<T> {
  const store = await boot();
  if (dialect === "postgres") {
    return orm.transaction(async (tx) => fn(databaseFor(tx))) as Promise<T>;
  }
  if (!store.sqlite) {
    throw new Error("SQLite connection is not open");
  }
  return withSessionLock(() =>
    executeSqliteTransaction(store.sqlite as Database.Database, fn),
  );
}

export async function ensureDatabase(): Promise<void> {
  await boot();
}

export const db: Database = new Proxy({} as Database, {
  get(_target, property) {
    if (property === "transaction") {
      return (fn: (tx: Database) => Promise<unknown>) =>
        boot().then((store) => runTransaction(store.orm, fn));
    }
    const orm = requireStore().orm;
    const value = (orm as Record<PropertyKey, unknown>)[property];
    if (typeof value !== "function") return value;
    return (value as (...args: unknown[]) => unknown).bind(orm);
  },
}) as Database;
