/**
 * Cross-cutting vocabulary shared by every domain model.
 *
 * Nothing in the domain layer performs I/O or knows about PowerShell, the
 * filesystem or the terminal. It only describes what the application reasons
 * about, so it stays trivially testable.
 */

/** How confident rux is that acting on an item is harmless. */
export const RISK_LEVELS = ['safe', 'review', 'sensitive'] as const;
export type Risk = (typeof RISK_LEVELS)[number];

/** How much a recommendation is expected to matter to the user. */
export const IMPACT_LEVELS = ['critical', 'high', 'medium', 'low', 'info'] as const;
export type Impact = (typeof IMPACT_LEVELS)[number];

export const IMPACT_ORDER: Readonly<Record<Impact, number>> = Object.freeze({
	critical: 0,
	high: 1,
	medium: 2,
	low: 3,
	info: 4,
});

/** Whether an operation requires an elevated (administrator) process. */
export type Elevation = 'user' | 'administrator';

/** A byte count, kept as a branded number so sizes are never confused with counts. */
export type Bytes = number & {readonly __brand: 'Bytes'};

export function bytes(value: number): Bytes {
	return (Number.isFinite(value) && value > 0 ? value : 0) as Bytes;
}

/**
 * A localizable message: the key plus the values it interpolates. The domain
 * never formats user-facing text, so it can stay language agnostic.
 */
export interface LocalizableText {
	readonly key: string;
	readonly values?: Readonly<Record<string, string | number>>;
}

export function text(key: string, values?: Record<string, string | number>): LocalizableText {
	return values ? {key, values} : {key};
}
