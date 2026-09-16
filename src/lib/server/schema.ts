import type { StandardSchemaV1 } from "@standard-schema/spec";

/** Minimal Standard Schema over the domain validators. */
export function schema<T>(
  validate: (value: unknown) => StandardSchemaV1.Result<T>
): StandardSchemaV1<T, T> {
  return { "~standard": { version: 1, vendor: "app-map", validate } };
}
