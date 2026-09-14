import {analyzeDrivers} from '@/domain/services/driver-advisor';
import {analyzeGraphics} from '@/domain/services/graphics-advisor';
import {analyzeWsl} from '@/domain/services/wsl-advisor';
import {JUNK_CATALOG} from '@/domain/services/junk-catalog';
import {correlateProcesses} from '@/domain/services/process-matcher';
import type {HardwareReport} from '@/domain/hardware';
import type {JunkFinding, JunkReport, JunkTarget} from '@/domain/junk';
import type {Recommendation} from '@/domain/recommendation';
import {sortRecommendations} from '@/domain/recommendation';
import type {ResidueClass, ResidueFinding, ResidueReport} from '@/domain/residue';
import {RESIDUE_CLASSES, requiresElevation} from '@/domain/residue';
import type {ProcessInfo, StartupInventory} from '@/domain/startup';
import type {WslStatus} from '@/domain/wsl';
import type {
	BackupPort,
	BackupSummary,
	HardwarePort,
	JunkCleanPort,
	JunkCleanResult,
	JunkScanPort,
	Ports,
	RemovalResult,
	ResidueRemovalPort,
	ResidueScanPort,
	RestoreResult,
	StartupInventoryPort,
	StartupMutation,
	StartupMutationPort,
	WslPort,
} from '@/application/ports';

const nowIso = (): string => new Date().toISOString();

export class ScanStartup {
	constructor(private readonly port: StartupInventoryPort) {}

	async execute(includeTasks: boolean): Promise<StartupInventory> {
		const raw = await this.port.readStartupEntries(includeTasks);
		return {
			entries: correlateProcesses(raw.entries, raw.processes),
			processes: raw.processes,
			elevated: raw.elevated,
			machineName: raw.machineName,
			userName: raw.userName,
			tasksIncluded: includeTasks,
			scannedAt: nowIso(),
		};
	}
}

/** Cheap refresh that re-reads only the process table and re-correlates in memory. */
export class RefreshProcesses {
	constructor(private readonly port: StartupInventoryPort) {}

	async execute(inventory: StartupInventory): Promise<StartupInventory> {
		const processes: readonly ProcessInfo[] = await this.port.readProcesses();
		return {...inventory, processes, entries: correlateProcesses(inventory.entries, processes)};
	}
}

export class MutateStartupEntry {
	constructor(private readonly port: StartupMutationPort) {}

	async execute(entry: StartupInventory['entries'][number], mutation: StartupMutation): Promise<void> {
		await this.port.mutate(entry, mutation);
	}
}

export class ScanResidue {
	constructor(private readonly port: ResidueScanPort) {}

	async execute(classes: readonly ResidueClass[] = RESIDUE_CLASSES, deep = false): Promise<ResidueReport> {
		const result = await this.port.scan(classes, deep);
		return {
			findings: result.findings,
			classesScanned: classes,
			deep,
			elevated: result.elevated,
			scannedAt: nowIso(),
		};
	}
}

export class RemoveResidue {
	constructor(private readonly port: ResidueRemovalPort) {}

	async execute(findings: readonly ResidueFinding[], elevated: boolean): Promise<RemovalResult> {
		if (findings.length === 0) {
			return {removed: 0, failed: 0, backupId: null, receipts: []};
		}
		const elevate = requiresElevation(findings) && !elevated;
		return this.port.remove(findings, elevate);
	}
}

export class ScanJunk {
	constructor(private readonly port: JunkScanPort) {}

	async execute(targets: readonly JunkTarget[] = JUNK_CATALOG): Promise<JunkReport> {
		const findings = await this.port.measure(targets);
		return {
			findings: findings.filter(finding => finding.exists),
			elevated: false,
			scannedAt: nowIso(),
		};
	}
}

export class CleanJunk {
	constructor(private readonly port: JunkCleanPort) {}

	async execute(findings: readonly JunkFinding[], elevated: boolean): Promise<JunkCleanResult> {
		if (findings.length === 0) {
			return {cleared: 0, failed: 0, freedBytes: 0, receipts: []};
		}
		const elevate = findings.some(finding => finding.target.elevation === 'administrator') && !elevated;
		return this.port.clean(findings, elevate);
	}
}

export interface HardwareAnalysis {
	readonly report: HardwareReport;
	readonly wsl: WslStatus | null;
	readonly recommendations: readonly Recommendation[];
}

/**
 * Hardware and WSL are inspected together because WSL advice is a function of
 * host capabilities: a memory limit is only wrong relative to installed RAM.
 */
export class AnalyzeHardware {
	constructor(
		private readonly hardware: HardwarePort,
		private readonly wsl: WslPort,
	) {}

	async execute(): Promise<HardwareAnalysis> {
		const [report, wslStatus] = await Promise.all([this.hardware.inspect(), this.wsl.inspect()]);
		const recommendations = sortRecommendations([
			...analyzeGraphics(report.graphics),
			...analyzeDrivers(report.drivers, report.capabilities),
			...analyzeWsl(wslStatus, report.capabilities),
		]);
		return {report, wsl: wslStatus.installed ? wslStatus : null, recommendations};
	}
}

export class ManageBackups {
	constructor(private readonly port: BackupPort) {}

	list(): Promise<readonly BackupSummary[]> {
		return this.port.list();
	}

	restore(backupId: string): Promise<RestoreResult> {
		return this.port.restore(backupId);
	}

	purge(backupId: string): Promise<void> {
		return this.port.purge(backupId);
	}
}

/** Every use case, constructed once from the assembled ports. */
export interface UseCases {
	readonly scanStartup: ScanStartup;
	readonly refreshProcesses: RefreshProcesses;
	readonly mutateStartupEntry: MutateStartupEntry;
	readonly scanResidue: ScanResidue;
	readonly removeResidue: RemoveResidue;
	readonly scanJunk: ScanJunk;
	readonly cleanJunk: CleanJunk;
	readonly analyzeHardware: AnalyzeHardware;
	readonly manageBackups: ManageBackups;
}

export function createUseCases(ports: Ports): UseCases {
	return {
		scanStartup: new ScanStartup(ports.startupInventory),
		refreshProcesses: new RefreshProcesses(ports.startupInventory),
		mutateStartupEntry: new MutateStartupEntry(ports.startupMutation),
		scanResidue: new ScanResidue(ports.residueScan),
		removeResidue: new RemoveResidue(ports.residueRemoval),
		scanJunk: new ScanJunk(ports.junkScan),
		cleanJunk: new CleanJunk(ports.junkClean),
		analyzeHardware: new AnalyzeHardware(ports.hardware, ports.wsl),
		manageBackups: new ManageBackups(ports.backup),
	};
}
