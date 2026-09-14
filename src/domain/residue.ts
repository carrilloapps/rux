import type {Bytes, Elevation, LocalizableText, Risk} from '@/domain/common';

/** Categories of leftover that an uninstaller can leave behind. */
export const RESIDUE_CLASSES = [
	'startup',
	'uninstall',
	'service',
	'task',
	'shortcut',
	'apppath',
	'firewall',
	'directory',
] as const;
export type ResidueClass = (typeof RESIDUE_CLASSES)[number];

export function isResidueClass(value: string): value is ResidueClass {
	return (RESIDUE_CLASSES as readonly string[]).includes(value);
}

/** The operation needed to remove an item, and the handle it acts on. */
export type RemovalKind = 'registryValue' | 'registryKey' | 'path' | 'service' | 'task' | 'firewall';

export interface RemovalDescriptor {
	readonly kind: RemovalKind;
	/** Registry path, filesystem path, service name, task name or rule name. */
	readonly target: string;
	/** Registry value name, when the kind addresses a value rather than a key. */
	readonly valueName: string | null;
	readonly taskPath: string | null;
}

/**
 * One leftover. Every finding carries the evidence that produced it and the
 * descriptor needed to act on it, so no consumer has to re-derive either.
 */
export interface ResidueFinding {
	readonly id: string;
	readonly residueClass: ResidueClass;
	readonly title: string;
	readonly reason: LocalizableText;
	/** The path that no longer exists; the proof behind the finding. */
	readonly evidence: string | null;
	readonly risk: Risk;
	readonly sizeBytes: Bytes;
	readonly elevation: Elevation;
	readonly removal: RemovalDescriptor;
}

export interface ResidueReport {
	readonly findings: readonly ResidueFinding[];
	readonly classesScanned: readonly ResidueClass[];
	readonly deep: boolean;
	readonly elevated: boolean;
	readonly scannedAt: string;
}

export function requiresElevation(findings: readonly ResidueFinding[]): boolean {
	return findings.some(finding => finding.elevation === 'administrator');
}

export function safeFindings(findings: readonly ResidueFinding[]): readonly ResidueFinding[] {
	return findings.filter(finding => finding.risk === 'safe');
}
