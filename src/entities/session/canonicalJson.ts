type JsonValue = string | number | boolean | null | ReadonlyArray<JsonValue> | { readonly [key: string]: JsonValue };
const isRecord = (value: JsonValue): value is { readonly [key: string]: JsonValue } => typeof value === 'object' && value !== null && !Array.isArray(value);
export const canonicalJson = (value: JsonValue): string => Array.isArray(value) ? `[${value.map(canonicalJson).join(',')}]` : isRecord(value) ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}` : JSON.stringify(value);
