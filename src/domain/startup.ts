import type {Bytes, Elevation} from '@/domain/common';

/** Where Windows reads a startup entry from. */
export const STARTUP_SOURCES = [
	'run-user',
	'run-once-user',
	'run-machine',
	'run-once-machine',
	'run-machine-x86',
	'run-once-machine-x86',
	'startup-folder-user',
	'startup-folder-machine',
	'scheduled-task',
] as const;
export type StartupSource = (typeof STARTUP_SOURCES)[number];

/** The mechanism used to enable, disable or remove an entry. */
export type StartupKind = 'registry' | 'folder' | 'task';

export type StartupStatus = 'running' | 'stopped' | 'disabled' | 'missing';

/**
 * Why a live process was attributed to a startup entry. Surfaced in the UI so a
 * "running" claim can always be traced back to the rule that produced it.
 */
export type MatchReason = 'path' | 'command' | 'name' | 'directory';

export interface ProcessInfo {
	readonly pid: number;
	readonly name: string;
	readonly executablePath: string | null;
	readonly memoryBytes: Bytes;
}

/** A startup entry as read from Windows, before process correlation. */
export interface RawStartupEntry {
	readonly id: string;
	readonly name: string;
	readonly command: string;
	readonly executablePath: string | null;
	readonly executableName: string | null;
	readonly source: StartupSource;
	readonly kind: StartupKind;
	readonly elevation: Elevation;
	readonly enabled: boolean;
	/** Registry key, shortcut path or task path this entry lives in. */
	readonly location: string;
	/** StartupApproved sub-key that owns the enabled flag, when one applies. */
	readonly approvalKey: string | null;
	readonly approvalHive: 'HKCU' | 'HKLM' | null;
	readonly taskPath: string | null;
	readonly executableExists: boolean;
	readonly publisher: string | null;
	readonly fileSizeBytes: Bytes | null;
	readonly modifiedAt: string | null;
}

/** A startup entry joined with the processes currently attributed to it. */
export interface StartupEntry extends RawStartupEntry {
	readonly running: boolean;
	readonly pids: readonly number[];
	readonly memoryBytes: Bytes;
	readonly matchReason: MatchReason | null;
}

export interface StartupInventory {
	readonly entries: readonly StartupEntry[];
	readonly processes: readonly ProcessInfo[];
	readonly elevated: boolean;
	readonly machineName: string;
	readonly userName: string;
	readonly tasksIncluded: boolean;
	readonly scannedAt: string;
}

export function statusOf(entry: StartupEntry): StartupStatus {
	if (!entry.enabled) return 'disabled';
	if (!entry.executableExists) return 'missing';
	return entry.running ? 'running' : 'stopped';
}

/** An entry can only be toggled when Windows tracks an approval flag for it. */
export function canToggle(entry: RawStartupEntry): boolean {
	return entry.kind === 'task' || entry.approvalKey !== null;
}
