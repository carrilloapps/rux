import {z} from 'zod';

/**
 * Wraps a schema so it tolerates the two shapes PowerShell's ConvertTo-Json
 * produces for collections.
 *
 * `ConvertTo-Json` emits a bare object rather than a one-element array when a
 * collection holds a single item, and emits nothing at all for an empty one.
 * Parsing raw output with `z.array` therefore fails on exactly the machines
 * that have one leftover or none, which is the common case.
 *
 * The generic is constrained to `z.ZodType` rather than a cast, so element
 * types survive inference and `z.infer` stays precise at the call site.
 */
export function psArray<T extends z.ZodType>(item: T): z.ZodType<z.output<T>[], unknown> {
	const widen = (value: unknown): unknown[] => {
		if (value === null || value === undefined) return [];
		return Array.isArray(value) ? (value as unknown[]) : [value];
	};
	return z.preprocess(widen, z.array(item));
}

/*
 * Every helper below is `.optional()`, which is what makes the key itself
 * allowed to be missing.
 *
 * A union that merely includes `z.undefined()` is not enough: it accepts a key
 * present with an undefined value but rejects a key that is absent. PowerShell
 * omits a property entirely when it has nothing to report, so the difference is
 * the difference between reading a machine with no WSL installed and failing on
 * it.
 */

/** A string that may arrive as null, as an empty string, or be absent entirely. */
export const psString = z
	.union([z.string(), z.null()])
	.optional()
	.transform((value): string | null => (value === undefined || value === '' ? null : value));

/** A number that may arrive as null or be absent. */
export const psNumber = z
	.union([z.number(), z.null()])
	.optional()
	.transform((value): number | null => (value === undefined ? null : value));

/** A boolean that may arrive as null or be absent; unknown becomes null. */
export const psBoolean = z
	.union([z.boolean(), z.null()])
	.optional()
	.transform((value): boolean | null => (value === undefined ? null : value));

/** A number that must exist; anything unusable becomes the supplied default. */
export function psCount(fallback = 0) {
	return z
		.union([z.number(), z.null()])
		.optional()
		.transform((value): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback));
}

/** A string that must exist; anything unusable becomes the supplied default. */
export function psText(fallback = '') {
	return z
		.union([z.string(), z.null()])
		.optional()
		.transform((value): string => (typeof value === 'string' ? value : fallback));
}
