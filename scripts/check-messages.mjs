import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { locales } from "../src/i18n/config.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function flatten(value, prefix, locale) {
  if (typeof value === "string") {
    if (value === "") {
      errors.push(`${locale}: ${prefix} is empty`);
    }
    return prefix ? [prefix] : [];
  }

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    errors.push(
      `${locale}: ${prefix || "(root)"} is not a message or a group`,
    );
    return prefix ? [prefix] : [];
  }

  const keys = [];
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    keys.push(...flatten(child, path, locale));
  }
  return keys;
}

const trees = new Map();

for (const locale of locales) {
  const path = join(root, "messages", `${locale}.json`);
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    const missing = error && error.code === "ENOENT";
    errors.push(
      missing
        ? `missing catalog messages/${locale}.json`
        : `could not read messages/${locale}.json`,
    );
    continue;
  }

  trees.set(locale, new Set(flatten(parsed, "", locale)));
}

const base = trees.entries().next().value;
if (base) {
  const [baseLocale, baseKeys] = base;
  for (const [locale, keys] of trees) {
    if (locale === baseLocale) continue;
    for (const key of baseKeys) {
      if (!keys.has(key)) {
        errors.push(`${locale} is missing ${key}`);
      }
    }
    for (const key of keys) {
      if (!baseKeys.has(key)) {
        errors.push(`${baseLocale} is missing ${key}`);
      }
    }
  }
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error);
  }
  process.exit(1);
}
