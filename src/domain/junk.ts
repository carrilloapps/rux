import type {Bytes, Elevation, LocalizableText, Risk} from '@/domain/common';

/** Families of disposable data Windows and common toolchains accumulate. */
export const JUNK_CATEGORIES = [
	'user-temp',
	'system-temp',
	'windows-update',
	'delivery-optimization',
	'prefetch',
	'thumbnail-cache',
	'icon-cache',
	'error-reports',
	'crash-dumps',
	'recycle-bin',
	'font-cache',
	'event-logs',
	'browser-cache',
	'package-manager-cache',
	'installer-cache',
	'log-files',
] as const;
export type JunkCategory = (typeof JUNK_CATEGORIES)[number];

/**
 * How a junk location is cleared.
 *
 * `contents` empties a directory but keeps the directory itself, which is what
 * Windows expects for locations it recreates lazily (Temp, Prefetch). `entry`
 * removes a single file or folder. `recycle-bin` needs a dedicated shell call.
 */
export type JunkSweep = 'contents' | 'entry' | 'recycle-bin';

/** A location rux knows how to inspect, declared independently of the machine. */
export interface JunkTarget {
	readonly id: string;
	readonly category: JunkCategory;
	/** Path with environment variables still unexpanded, e.g. `%LOCALAPPDATA%\Temp`. */
	readonly path: string;
	readonly sweep: JunkSweep;
	readonly risk: Risk;
	readonly elevation: Elevation;
	readonly description: LocalizableText;
	/** Files newer than this are left alone; guards against deleting live data. */
	readonly minimumAgeDays: number;
	/** Glob-free filename suffixes to restrict the sweep to, when set. */
	readonly extensions: readonly string[] | null;
}

/** A junk target measured against the current machine. */
export interface JunkFinding {
	readonly target: JunkTarget;
	readonly resolvedPath: string;
	readonly exists: boolean;
	readonly fileCount: number;
	readonly sizeBytes: Bytes;
	/** Set when the location could be read only partially, e.g. files in use. */
	readonly note: LocalizableText | null;
}

export interface JunkReport {
	readonly findings: readonly JunkFinding[];
	readonly elevated: boolean;
	readonly scannedAt: string;
}
