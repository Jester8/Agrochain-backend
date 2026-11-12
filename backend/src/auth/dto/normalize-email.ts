import { TransformFnParams } from 'class-transformer';

// Prevents "John@x.com" and "john@x.com" from being treated as different
// accounts, and keeps every DB lookup/comparison on a consistent value.
export function normalizeEmail({ value }: TransformFnParams) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}
