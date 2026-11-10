export const dialects = ["sqlite", "postgres"] as const;

export type Dialect = (typeof dialects)[number];

export function resolveDialect(
  value: string | undefined = process.env.DATABASE_DIALECT,
): Dialect {
  if (value === undefined || value === "" || value === "sqlite") {
    return "sqlite";
  }
  if (value === "postgres") {
    return "postgres";
  }
  throw new Error(
    `Unsupported DATABASE_DIALECT "${value}". Use sqlite or postgres.`,
  );
}

export const dialect = resolveDialect();
