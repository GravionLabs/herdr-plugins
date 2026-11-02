// Minimal JSON schema validator for the plugin config schemas (no runtime dependency). Identical copy in every plugin
// that reads a config.json; test/config-schema.test.ts keeps the copies equal. Supports: type (string, number, integer,
// boolean, array, object), enum, minimum, maximum, exclusiveMinimum, exclusiveMaximum, minLength, minItems,
// properties, required, additionalProperties (false), items. Pure.

export type Schema = {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minLength?: number;
  minItems?: number;
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: Schema;
};

const kind = (v: unknown): string => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

function typeOk(type: string, v: unknown): boolean {
  if (type === 'integer') return typeof v === 'number' && Number.isInteger(v);
  return kind(v) === type;
}

// Problems as `<path>: <message>`; empty when the value matches the schema. The path of the root is `config`.
export function validate(value: unknown, schema: Schema, path = 'config'): string[] {
  if (schema.type && !typeOk(schema.type, value)) return [`${path}: expected ${schema.type}, got ${kind(value)}`];
  const problems: string[] = [];
  if (schema.enum && !schema.enum.some((e) => e === value)) {
    problems.push(`${path}: must be one of ${schema.enum.map((e) => JSON.stringify(e)).join(', ')}`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) problems.push(`${path}: must be at least ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) problems.push(`${path}: must be at most ${schema.maximum}`);
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      problems.push(`${path}: must be greater than ${schema.exclusiveMinimum}`);
    }
    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
      problems.push(`${path}: must be less than ${schema.exclusiveMaximum}`);
    }
  }
  if (typeof value === 'string' && schema.minLength !== undefined && value.trim().length < schema.minLength) {
    problems.push(`${path}: must not be empty`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) problems.push(`${path}: must not be empty`);
    const items = schema.items;
    if (items) value.forEach((item, i) => problems.push(...validate(item, items, `${path}[${i}]`)));
  }
  if (kind(value) === 'object') {
    const object = value as Record<string, unknown>;
    const at = (key: string): string => (path === 'config' ? key : `${path}.${key}`);
    for (const key of schema.required ?? []) if (!(key in object)) problems.push(`${at(key)}: required`);
    for (const [key, v] of Object.entries(object)) {
      const sub = schema.properties?.[key];
      if (sub) problems.push(...validate(v, sub, at(key)));
      else if (schema.additionalProperties === false) problems.push(`${at(key)}: unknown key`);
    }
  }
  return problems;
}

// Problems of a config.json text against the schema, each prefixed with the file name. Missing text (no file) is valid.
export function configProblems(text: string | null | undefined, schema: Schema, file = 'config.json'): string[] {
  if (text === null || text === undefined) return [];
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [`${file}: invalid JSON`];
  }
  return validate(data, schema).map((p) => `${file}: ${p.replace(/^config: /, '')}`);
}
