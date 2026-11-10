import { sql } from "drizzle-orm";
import * as pg from "drizzle-orm/pg-core";
import * as sqlite from "drizzle-orm/sqlite-core";
import { dialect } from "./dialect";

function sqlitePrimaryKey() {
  return sqlite.integer("id").primaryKey({ autoIncrement: true });
}

type SchemaApi = {
  id: () => ReturnType<typeof sqlitePrimaryKey>;
  integer: typeof sqlite.integer;
  text: typeof sqlite.text;
  real: typeof sqlite.real;
  millis: typeof sqlite.integer;
  table: typeof sqlite.sqliteTable;
  check: typeof sqlite.check;
  uniqueIndex: typeof sqlite.uniqueIndex;
};

function sqliteApi(): SchemaApi {
  return {
    id: sqlitePrimaryKey,
    integer: sqlite.integer,
    text: sqlite.text,
    real: sqlite.real,
    millis: sqlite.integer,
    table: sqlite.sqliteTable,
    check: sqlite.check,
    uniqueIndex: sqlite.uniqueIndex,
  };
}

function postgresApi(): SchemaApi {
  return {
    id: () =>
      pg.integer("id").primaryKey().generatedByDefaultAsIdentity() as unknown as ReturnType<
        SchemaApi["id"]
      >,
    integer: pg.integer as unknown as SchemaApi["integer"],
    text: pg.text as unknown as SchemaApi["text"],
    real: pg.doublePrecision as unknown as SchemaApi["real"],
    // Postgres integer is 32-bit. Millisecond timestamps need bigint.
    millis: ((name: string) =>
      pg.bigint(name, { mode: "number" })) as unknown as SchemaApi["millis"],
    table: pg.pgTable as unknown as SchemaApi["table"],
    check: pg.check as unknown as SchemaApi["check"],
    uniqueIndex: pg.uniqueIndex as unknown as SchemaApi["uniqueIndex"],
  };
}

function defineSchema(api: SchemaApi) {
  const categories = api.table("categories", {
    id: api.id(),
    name: api.text("name").notNull(),
    createdAt: api.millis("created_at").notNull(),
  });

  const subcategories = api.table("subcategories", {
    id: api.id(),
    categoryId: api
      .integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    name: api.text("name").notNull(),
    createdAt: api.millis("created_at").notNull(),
  });

  const products = api.table(
    "products",
    {
      id: api.id(),
      subcategoryId: api
        .integer("subcategory_id")
        .notNull()
        .references(() => subcategories.id, { onDelete: "restrict" }),
      name: api.text("name").notNull(),
      description: api.text("description"),
      priceCents: api.integer("price_cents").notNull(),
      isAvailable: api.integer("is_available").notNull().default(1),
      position: api.integer("position").notNull().default(0),
      createdAt: api.millis("created_at").notNull(),
    },
    (table) => [
      api.check(
        "products_price_cents_non_negative",
        sql`${table.priceCents} >= 0`,
      ),
      api.check(
        "products_is_available_bool",
        sql`${table.isAvailable} in (0, 1)`,
      ),
    ],
  );

  const floors = api.table("floors", {
    id: api.id(),
    name: api.text("name").notNull(),
    width: api.integer("width").notNull().default(1600),
    height: api.integer("height").notNull().default(1000),
    createdAt: api.millis("created_at").notNull(),
  });

  const floorItems = api.table(
    "floor_items",
    {
      id: api.id(),
      floorId: api
        .integer("floor_id")
        .notNull()
        .references(() => floors.id, { onDelete: "cascade" }),
      kind: api.text("kind").notNull(),
      shape: api.text("shape").notNull(),
      label: api.text("label"),
      seats: api.integer("seats"),
      x: api.real("x").notNull(),
      y: api.real("y").notNull(),
      width: api.real("width").notNull(),
      height: api.real("height").notNull(),
      rotation: api.real("rotation").notNull().default(0),
      points: api.text("points"),
      zIndex: api.integer("z_index").notNull().default(0),
      color: api.text("color"),
      fixture: api.text("fixture"),
      createdAt: api.millis("created_at").notNull(),
    },
    (table) => [
      api.check(
        "floor_items_kind",
        sql`${table.kind} in ('table', 'block', 'outline')`,
      ),
      api.check(
        "floor_items_shape",
        sql`${table.shape} in ('circle', 'square', 'rectangle', 'polygon')`,
      ),
      api.check(
        "floor_items_points",
        sql`(${table.shape} = 'polygon' and ${table.points} is not null) or (${table.shape} <> 'polygon' and ${table.points} is null)`,
      ),
      api.check(
        "floor_items_polygon_rotation",
        sql`${table.shape} <> 'polygon' or ${table.rotation} = 0`,
      ),
      api.check(
        "floor_items_seats",
        sql`${table.seats} is null or (${table.kind} = 'table' and ${table.seats} >= 1)`,
      ),
      api.check(
        "floor_items_color",
        sql`${table.color} is null or ${table.color} in ('sand', 'linen', 'clay', 'sage', 'sea', 'stone', 'wood', 'ink')`,
      ),
      api.check(
        "floor_items_fixture",
        sql`${table.fixture} is null or (${table.kind} = 'block' and ${table.fixture} in ('column', 'door', 'window'))`,
      ),
    ],
  );

  const orders = api.table(
    "orders",
    {
      id: api.id(),
      floorItemId: api
        .integer("floor_item_id")
        .notNull()
        .references(() => floorItems.id, { onDelete: "restrict" }),
      status: api.text("status").notNull(),
      openedAt: api.millis("opened_at").notNull(),
      closedAt: api.millis("closed_at"),
      createdAt: api.millis("created_at").notNull(),
    },
    (table) => [
      api.check("orders_status", sql`${table.status} in ('open', 'closed')`),
      api
        .uniqueIndex("orders_one_open_per_floor_item")
        .on(table.floorItemId)
        .where(sql`${table.status} = 'open'`),
    ],
  );

  const orderItems = api.table(
    "order_items",
    {
      id: api.id(),
      orderId: api
        .integer("order_id")
        .notNull()
        .references(() => orders.id, { onDelete: "cascade" }),
      productId: api
        .integer("product_id")
        .notNull()
        .references(() => products.id, { onDelete: "restrict" }),
      productName: api.text("product_name").notNull(),
      unitPriceCents: api.integer("unit_price_cents").notNull(),
      quantity: api.integer("quantity").notNull(),
      note: api.text("note"),
      createdAt: api.millis("created_at").notNull(),
    },
    (table) => [
      api.check(
        "order_items_unit_price_cents_non_negative",
        sql`${table.unitPriceCents} >= 0`,
      ),
      api.check(
        "order_items_quantity_positive",
        sql`${table.quantity} >= 1`,
      ),
    ],
  );

  return {
    categories,
    subcategories,
    products,
    floors,
    floorItems,
    orders,
    orderItems,
  };
}

const tables = defineSchema(dialect === "postgres" ? postgresApi() : sqliteApi());

export const categories = tables.categories;
export const subcategories = tables.subcategories;
export const products = tables.products;
export const floors = tables.floors;
export const floorItems = tables.floorItems;
export const orders = tables.orders;
export const orderItems = tables.orderItems;
