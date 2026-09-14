import type {UseCases} from '@/application/use-cases';
import {JUNK_CATALOG} from '@/domain/services/junk-catalog';
import type {JunkFinding} from '@/domain/junk';
import type {ResidueFinding} from '@/domain/residue';
import {safeFindings} from '@/domain/residue';
import type {Translator} from '@/i18n/translator';
import {formatBytes} from '@/shared/format';
import {renderHardware, renderJunk, renderResidue, renderStartup} from '@/presentation/cli/reports';
import {residueClasses, startSession, type CliOptions} from '@/presentation/cli/options';

export type Printer = (line: string) => void;

export interface CommandContext {
	readonly useCases: UseCases;
	readonly options: CliOptions;
	readonly print: Printer;
}

/**
 * Non-interactive command bodies.
 *
 * Every one follows the same shape: resolve the language, run one use case,
 * then either emit JSON or render text. The mutating commands add a confirmed
 * "apply the safe subset" step on top of that, which `applySafeSubset` holds so
 * the two of them cannot drift apart.
 */

export async function runStartupReport({useCases, options, print}: CommandContext): Promise<void> {
	const {t} = await startSession(options);
	const inventory = await useCases.scanStartup.execute(options.tasks === true);
	print(options.json === true ? JSON.stringify(inventory, null, 2) : renderStartup(inventory, t));
}

export async function runHardwareReport({useCases, options, print}: CommandContext): Promise<void> {
	const {t} = await startSession(options);
	const analysis = await useCases.analyzeHardware.execute();
	print(options.json === true ? JSON.stringify(analysis, null, 2) : renderHardware(analysis, t));
}

export async function runBackupsReport({useCases, options, print}: CommandContext): Promise<void> {
	const {t} = await startSession(options);
	const backups = await useCases.manageBackups.list();

	if (options.json === true) {
		print(JSON.stringify(backups, null, 2));
		return;
	}
	if (backups.length === 0) {
		print(`  ${t('backups.empty')}`);
		return;
	}
	for (const backup of backups) {
		print(
			`  ${t('backups.item', {
				id: backup.backupId,
				count: backup.itemCount,
				date: backup.createdAt.slice(0, 19).replace('T', ' '),
			})}`,
		);
		print(`    ${backup.titles.join(', ')}${backup.itemCount > backup.titles.length ? ', ...' : ''}`);
	}
	print('');
	print(`  ${t('backups.restoreHint')}`);
}

interface SafeSubsetPlan<T> {
	readonly items: readonly T[];
	readonly describe: (item: T) => string;
	readonly needsElevation: (item: T) => boolean;
	readonly hint: string;
	readonly apply: () => Promise<void>;
}

/**
 * Shared tail for --yes: report what would happen, stop on --dry-run, otherwise
 * apply. Keeps the confirmation and elevation wording identical everywhere.
 */
async function applySafeSubset<T>(
	plan: SafeSubsetPlan<T>,
	options: CliOptions,
	print: Printer,
	t: Translator,
): Promise<void> {
	if (options.yes !== true) {
		if (plan.items.length > 0) print(`  ${plan.hint}`);
		return;
	}
	if (plan.items.length === 0) {
		print(`  ${t('residue.nothingSafe')}`);
		return;
	}

	if (options.dryRun === true) {
		print('');
		print(`  ${t('cli.dryRunHeader', {count: plan.items.length})}`);
		for (const item of plan.items) print(`  ${plan.describe(item)}`);
		const elevated = plan.items.filter(plan.needsElevation).length;
		if (elevated > 0) {
			print('');
			print(`  ${t('cli.dryRunElevated', {count: elevated})}`);
		}
		return;
	}

	await plan.apply();
}

export async function runCleanReport({useCases, options, print}: CommandContext): Promise<void> {
	const {t} = await startSession(options);
	const report = await useCases.scanResidue.execute(residueClasses(options), options.deep === true);

	if (options.json === true) {
		print(JSON.stringify(report, null, 2));
		return;
	}

	print(renderResidue(report, t));

	const safe = safeFindings(report.findings);
	await applySafeSubset<ResidueFinding>(
		{
			items: safe,
			hint: t('cli.removeHint'),
			needsElevation: finding => finding.elevation === 'administrator',
			describe: finding => {
				const target = finding.removal.valueName
					? `${finding.removal.target} -> ${finding.removal.valueName}`
					: finding.removal.target;
				return `${finding.removal.kind.padEnd(14)} ${target}`;
			},
			apply: async () => {
				const result = await useCases.removeResidue.execute(safe, report.elevated);
				print('');
				print(`  ${t('residue.removed', {removed: result.removed, total: safe.length})}`);
				for (const receipt of result.receipts.filter(item => !item.ok)) {
					print(`  ! ${receipt.message}`);
				}
				if (result.backupId) {
					print(`  ${t('residue.backupCreated', {id: result.backupId})} rux restore ${result.backupId}`);
				}
			},
		},
		options,
		print,
		t,
	);
}

export async function runJunkReport({useCases, options, print}: CommandContext): Promise<void> {
	const {t} = await startSession(options);
	const report = await useCases.scanJunk.execute(JUNK_CATALOG);

	if (options.json === true) {
		print(JSON.stringify(report, null, 2));
		return;
	}

	print(renderJunk(report, t));

	// An empty location is safe but pointless to clear, so it is left out of the batch.
	const safe = report.findings.filter(finding => finding.target.risk === 'safe' && finding.sizeBytes > 0);

	await applySafeSubset<JunkFinding>(
		{
			items: safe,
			hint: t('cli.cleanHint'),
			needsElevation: finding => finding.target.elevation === 'administrator',
			describe: finding =>
				`${finding.target.sweep.padEnd(14)} ${finding.resolvedPath} (${formatBytes(finding.sizeBytes)})`,
			apply: async () => {
				const result = await useCases.cleanJunk.execute(safe, report.elevated);
				print('');
				print(`  ${t('junk.freed', {size: formatBytes(result.freedBytes), count: result.cleared})}`);
				for (const receipt of result.receipts.filter(item => !item.ok)) {
					print(`  ! ${receipt.id}: ${receipt.message}`);
				}
			},
		},
		options,
		print,
		t,
	);
}

export async function runRestore(
	{useCases, options, print}: CommandContext,
	backupId: string,
): Promise<boolean> {
	const {t} = await startSession(options);
	const result = await useCases.manageBackups.restore(backupId);
	print(`  ${t('backups.restored', {count: result.restored})}`);
	for (const receipt of result.receipts) {
		print(`  ${receipt.ok ? '+' : '!'} ${receipt.message}`);
	}
	return result.failed === 0;
}

export async function runPurge({useCases, options, print}: CommandContext, backupId: string): Promise<void> {
	const {t} = await startSession(options);
	await useCases.manageBackups.purge(backupId);
	print(`  ${t('backups.purged', {id: backupId})}`);
}
