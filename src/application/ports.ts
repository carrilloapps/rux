import type {HardwareReport} from '@/domain/hardware';
import type {JunkFinding, JunkTarget} from '@/domain/junk';
import type {ProcessInfo, RawStartupEntry} from '@/domain/startup';
import type {WslStatus} from '@/domain/wsl';
import type {ResidueClass, ResidueFinding} from '@/domain/residue';

/**
 * The boundary between the application and the operating system.
 *
 * Use cases depend only on these interfaces, so every one of them can run
 * against in-memory fakes in tests. Nothing here mentions PowerShell, the
 * registry API or the filesystem directly.
 */

export interface StartupInventoryPort {
	readStartupEntries(includeTasks: boolean): Promise<{
		entries: readonly RawStartupEntry[];
		processes: readonly ProcessInfo[];
		elevated: boolean;
		machineName: string;
		userName: string;
	}>;

	readProcesses(): Promise<readonly ProcessInfo[]>;
}

export type StartupMutation = 'enable' | 'disable' | 'remove';

export interface StartupMutationPort {
	mutate(entry: RawStartupEntry, mutation: StartupMutation): Promise<void>;
}

export interface ResidueScanPort {
	scan(
		classes: readonly ResidueClass[],
		deep: boolean,
	): Promise<{
		findings: readonly ResidueFinding[];
		elevated: boolean;
	}>;
}

export interface RemovalReceipt {
	readonly id: string;
	readonly ok: boolean;
	readonly message: string;
}

export interface RemovalResult {
	readonly removed: number;
	readonly failed: number;
	readonly backupId: string | null;
	readonly receipts: readonly RemovalReceipt[];
}

export interface ResidueRemovalPort {
	remove(findings: readonly ResidueFinding[], elevate: boolean): Promise<RemovalResult>;
}

export interface JunkScanPort {
	measure(targets: readonly JunkTarget[]): Promise<readonly JunkFinding[]>;
}

export interface JunkCleanResult {
	readonly cleared: number;
	readonly failed: number;
	readonly freedBytes: number;
	readonly receipts: readonly RemovalReceipt[];
}

export interface JunkCleanPort {
	clean(findings: readonly JunkFinding[], elevate: boolean): Promise<JunkCleanResult>;
}

export interface HardwarePort {
	inspect(): Promise<HardwareReport>;
}

export interface WslPort {
	inspect(): Promise<WslStatus>;
}

export interface BackupSummary {
	readonly backupId: string;
	readonly createdAt: string;
	readonly location: string;
	readonly itemCount: number;
	readonly titles: readonly string[];
}

export interface RestoreResult {
	readonly restored: number;
	readonly failed: number;
	readonly receipts: readonly RemovalReceipt[];
}

export interface BackupPort {
	list(): Promise<readonly BackupSummary[]>;
	restore(backupId: string): Promise<RestoreResult>;
	purge(backupId: string): Promise<void>;
}

/** Everything a use case can reach. Assembled once in the composition root. */
export interface Ports {
	readonly startupInventory: StartupInventoryPort;
	readonly startupMutation: StartupMutationPort;
	readonly residueScan: ResidueScanPort;
	readonly residueRemoval: ResidueRemovalPort;
	readonly junkScan: JunkScanPort;
	readonly junkClean: JunkCleanPort;
	readonly hardware: HardwarePort;
	readonly wsl: WslPort;
	readonly backup: BackupPort;
}
