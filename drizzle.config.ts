import { defineConfig } from "drizzle-kit";

const postgres = process.env.DATABASE_DIALECT === "postgres";

export default defineConfig(
  postgres
    ? {
        dialect: "postgresql",
        schema: "./src/lib/db/schema.ts",
        out: "./drizzle/postgres",
        dbCredentials: {
          url:
            process.env.DATABASE_URL ??
            "postgres://fudo:fudo@localhost:5432/fudo",
        },
      }
    : {
        dialect: "sqlite",
        schema: "./src/lib/db/schema.ts",
        out: "./drizzle/sqlite",
        dbCredentials: {
          url: process.env.DATABASE_URL?.startsWith("file:")
            ? process.env.DATABASE_URL
            : "file:data/fudo.sqlite",
        },
      },
);
