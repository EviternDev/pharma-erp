/**
 * Convert snake_case database row to camelCase TypeScript object.
 * Handles nested underscores correctly: "cost_price_paise" → "costPricePaise"
 */
export function toCamelCase<T>(row: object): T {
  const source = row as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
    result[camelKey] = source[key];
  }
  return result as T;
}

/**
 * Convert an array of snake_case database rows to camelCase TypeScript objects.
 */
export function toCamelCaseArray<T>(rows: object[]): T[] {
  return rows.map((row) => toCamelCase<T>(row));
}

/**
 * SQLite stores booleans as 0/1 integers.
 * This converts them to proper booleans in the result.
 */
export function toBool(value: unknown): boolean {
  return value === 1 || value === true;
}

/**
 * Convert a camelCase field name to snake_case for SQL queries.
 */
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
