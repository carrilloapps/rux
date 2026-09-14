import process from 'node:process';
import React from 'react';
import {Command, Option} from 'commander';
import {render} from 'ink';
import {createApplication} from '@/infrastructure/container';
import {RESIDUE_CLASSES, isResidueClass, safeFindings, type ResidueClass} from '@/domain/residue';
import {JUNK_CATALOG} from '@/domain/services/junk-catalog';
import {LOCALES, createTranslator, initI18n, isLocale, type Locale, type Translator} from '@/i18n/translator';
import {App, type View} from '@/presentation/tui/App';
import {createPreferenceStore} from '@/presentation/config';
import {renderHardware, renderJunk, renderResidue, renderStartup} from '@/presentation/cli/reports';
import {describeError} from '@/shared/errors';
import {formatBytes} from '@/shared/format';

const VERSION = '1.0.0';

interface GlobalOptions {
	readonly lang?: string;
	readonly json?: boolean;
	readonly list?: boolean;
	readonly tasks?: boolean;
	readonly deep?: boolean;
	readonly yes?: boolean;
	readonly dryRun?: boolean;
	readonly readOnly?: boolean;
	readonly interval?: string;
	readonly class?: string[];
}

function print(message: string): void {
	console.log(message);
}

function abort(message: string): never {
	console.error(`rux: ${message}`);
	process.exit(1);
}

async function bootstrap(options: GlobalOptions): Promise<{t: Translator; locale: Locale}> {
	const preferences = createPreferenceStore();
	const requested = options.lang;
	if (requested && !isLocale(requested)) {
		abort(`--lang expects one of: ${LOCALES.join(', ')}`);
	}
	const locale: Locale = requested && isLocale(requested) ? requested : preferences.getLocale();
	const i18n = await initI18n(locale);
	return {t: createTranslator(i18n), locale};
}

function requestedClasses(options: GlobalOptions): readonly ResidueClass[] {
	if (!options.class || options.class.length === 0) return RESIDUE_CLASSES;
	for (const candidate of options.class) {
		if (!isResidueClass(candidate)) {
			abort(`--class expects one of: ${RESIDUE_CLASSES.join(', ')}`);
		}
	}
	return options.class.filter(isResidueClass);
}

async function launchTui(view: View, options: GlobalOptions): Promise<void> {
	if (!process.stdout.isTTY) {
		const {t} = await bootstrap(options);
		abort(t('cli.ttyError'));
	}

	const preferences = createPreferenceStore();
	const {t, locale} = await bootstrap(options);
	const useCases = createApplication();

	// The whole tree re-renders on a language change, so every string is
	// re-resolved through the new translator without any component caching it.
	function Root() {
		const [currentLocale, setCurrentLocale] = React.useState<Locale>(locale);
		const [translator, setTranslator] = React.useState<Translator>(() => t);

		const handleLocaleChange = React.useCallback((next: Locale) => {
			void initI18n(next).then(instance => {
				setTranslator(() => createTranslator(instance));
				setCurrentLocale(next);
			});
		}, []);

		return (
			<App
				useCases={useCases}
				t={translator}
				locale={currentLocale}
				onLocaleChange={handleLocaleChange}
				preferences={preferences}
				initialView={view}
				includeTasks={options.tasks === true}
				deep={options.deep === true}
				readOnly={options.readOnly === true}
				refreshIntervalMs={options.interval === undefined ? 5000 : Number(options.interval)}
			/>
		);
	}

	const instance = render(<Root />, {exitOnCtrlC: true});
	await instance.waitUntilExit();
}

async function runStartupCommand(options: GlobalOptions): Promise<void> {
	if (!options.json && !options.list) return launchTui('startup', options);

	const {t} = await bootstrap(options);
	const inventory = await createApplication().scanStartup.execute(options.tasks === true);
	print(options.json ? JSON.stringify(inventory, null, 2) : renderStartup(inventory, t));
}

async function runCleanCommand(options: GlobalOptions): Promise<void> {
	if (!options.json && !options.list) return launchTui('residue', options);

	const {t} = await bootstrap(options);
	const useCases = createApplication();
	const report = await useCases.scanResidue.execute(requestedClasses(options), options.deep === true);

	if (options.json) {
		print(JSON.stringify(report, null, 2));
		return;
	}

	print(renderResidue(report, t));

	const safe = safeFindings(report.findings);
	if (!options.yes) {
		if (safe.length > 0) print(`  ${t('cli.removeHint')}`);
		return;
	}
	if (safe.length === 0) {
		print(`  ${t('residue.nothingSafe')}`);
		return;
	}

	if (options.dryRun) {
		print('');
		print(`  ${t('cli.dryRunHeader', {count: safe.length})}`);
		for (const finding of safe) {
			const target = finding.removal.valueName
				? `${finding.removal.target} -> ${finding.removal.valueName}`
				: finding.removal.target;
			print(`  ${finding.removal.kind.padEnd(14)} ${target}`);
		}
		const elevated = safe.filter(finding => finding.elevation === 'administrator').length;
		if (elevated > 0) print(`\n  ${t('cli.dryRunElevated', {count: elevated})}`);
		return;
	}

	const result = await useCases.removeResidue.execute(safe, report.elevated);
	print('');
	print(`  ${t('residue.removed', {removed: result.removed, total: safe.length})}`);
	for (const receipt of result.receipts.filter(item => !item.ok)) {
		print(`  ! ${receipt.message}`);
	}
	if (result.backupId) {
		print(`  ${t('residue.backupCreated', {id: result.backupId})} rux restore ${result.backupId}`);
	}
}

async function runJunkCommand(options: GlobalOptions): Promise<void> {
	if (!options.json && !options.list) return launchTui('junk', options);

	const {t} = await bootstrap(options);
	const useCases = createApplication();
	const report = await useCases.scanJunk.execute(JUNK_CATALOG);

	if (options.json) {
		print(JSON.stringify(report, null, 2));
		return;
	}

	print(renderJunk(report, t));

	const safe = report.findings.filter(finding => finding.target.risk === 'safe' && finding.sizeBytes > 0);
	if (!options.yes) {
		if (safe.length > 0) print(`  ${t('cli.cleanHint')}`);
		return;
	}
	if (safe.length === 0) {
		print(`  ${t('residue.nothingSafe')}`);
		return;
	}

	if (options.dryRun) {
		print('');
		print(`  ${t('cli.dryRunHeader', {count: safe.length})}`);
		for (const finding of safe) {
			print(
				`  ${finding.target.sweep.padEnd(14)} ${finding.resolvedPath} (${formatBytes(finding.sizeBytes)})`,
			);
		}
		const elevated = safe.filter(finding => finding.target.elevation === 'administrator').length;
		if (elevated > 0) print(`\n  ${t('cli.dryRunElevated', {count: elevated})}`);
		return;
	}

	const result = await useCases.cleanJunk.execute(safe, report.elevated);
	print('');
	print(`  ${t('junk.freed', {size: formatBytes(result.freedBytes), count: result.cleared})}`);
	for (const receipt of result.receipts.filter(item => !item.ok)) {
		print(`  ! ${receipt.id}: ${receipt.message}`);
	}
}

async function runHardwareCommand(options: GlobalOptions): Promise<void> {
	if (!options.json && !options.list) return launchTui('hardware', options);

	const {t} = await bootstrap(options);
	const analysis = await createApplication().analyzeHardware.execute();
	print(options.json ? JSON.stringify(analysis, null, 2) : renderHardware(analysis, t));
}

async function runBackupsCommand(options: GlobalOptions): Promise<void> {
	const {t} = await bootstrap(options);
	const backups = await createApplication().manageBackups.list();

	if (options.json) {
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

function buildProgram(): Command {
	const program = new Command();

	program
		.name('rux')
		.description('Windows system inspector and cleaner')
		.version(VERSION, '-v, --version')
		.addOption(new Option('--lang <locale>', 'interface language').choices([...LOCALES]))
		.option('--json', 'print machine-readable JSON and exit')
		.option('-l, --list', 'print a plain table and exit')
		.option('-t, --tasks', 'include scheduled tasks triggered at logon or boot')
		.option('--deep', 'also report program folders no installed program claims')
		.option('-y, --yes', 'with --list, apply the safe actions without asking')
		.option('--dry-run', 'with --yes, print exactly what would happen and stop')
		.option('--read-only', 'disable every mutating key in the interface')
		.option('--interval <ms>', 'process refresh interval; 0 disables', '5000')
		.option(
			'--class <name>',
			'limit a leftover scan to one class (repeatable)',
			(value, previous: string[]) => [...previous, value],
			[],
		);

	program
		.command('startup', {isDefault: true})
		.description('inspect what starts with Windows')
		.action(async () => {
			await runStartupCommand(program.opts<GlobalOptions>());
		});

	program
		.command('clean')
		.description('find and remove uninstall leftovers')
		.action(async () => {
			await runCleanCommand(program.opts<GlobalOptions>());
		});

	program
		.command('junk')
		.description('find and clear caches and junk files')
		.action(async () => {
			await runJunkCommand(program.opts<GlobalOptions>());
		});

	program
		.command('hardware')
		.description('inspect graphics, drivers and capabilities')
		.action(async () => {
			await runHardwareCommand(program.opts<GlobalOptions>());
		});

	program
		.command('backups')
		.description('list the backups rux can restore from')
		.action(async () => {
			await runBackupsCommand(program.opts<GlobalOptions>());
		});

	program
		.command('restore')
		.argument('<id>', 'backup id')
		.description('restore a backup')
		.action(async (id: string) => {
			const options = program.opts<GlobalOptions>();
			const {t} = await bootstrap(options);
			const result = await createApplication().manageBackups.restore(id);
			print(`  ${t('backups.restored', {count: result.restored})}`);
			for (const receipt of result.receipts) {
				print(`  ${receipt.ok ? '+' : '!'} ${receipt.message}`);
			}
			if (result.failed > 0) process.exitCode = 1;
		});

	program
		.command('purge')
		.argument('<id>', 'backup id')
		.description('delete a backup permanently')
		.action(async (id: string) => {
			const options = program.opts<GlobalOptions>();
			const {t} = await bootstrap(options);
			await createApplication().manageBackups.purge(id);
			print(`  ${t('backups.purged', {id})}`);
		});

	return program;
}

async function main(): Promise<void> {
	if (process.platform !== 'win32') {
		abort('rux supports Windows only.');
	}
	await buildProgram().parseAsync(process.argv);
}

main().catch((error: unknown) => {
	console.error(`rux: ${describeError(error)}`);
	process.exit(1);
});
