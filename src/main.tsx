import process from 'node:process';
import {useCallback, useState} from 'react';
import {Command, Option} from 'commander';
import {render} from 'ink';
import type {UseCases} from '@/application/use-cases';
import {RESIDUE_CLASSES} from '@/domain/residue';
import {LOCALES, createTranslator, initI18n, type Locale, type Translator} from '@/i18n/translator';
import {createApplication} from '@/infrastructure/container';
import {describeError} from '@/shared/errors';
import {VERSION} from '@/shared/version';
import {
	runBackupsReport,
	runCleanReport,
	runHardwareReport,
	runJunkReport,
	runPurge,
	runRestore,
	runStartupReport,
	type CommandContext,
} from '@/presentation/cli/commands';
import {isNonInteractive, refreshIntervalMs, startSession, type CliOptions} from '@/presentation/cli/options';
import {createPreferenceStore} from '@/presentation/config';
import {App} from '@/presentation/tui/App';
import type {View} from '@/presentation/tui/view';

const print = (line: string): void => {
	console.log(line);
};

/**
 * Hosts the interface and owns the language, the one piece of state that has to
 * survive a re-render of the whole tree. Changing it swaps the translator, so
 * every string resolves again with no component caching the old one.
 */
function Root(props: {
	readonly useCases: UseCases;
	readonly initialLocale: Locale;
	readonly initialTranslator: Translator;
	readonly view: View;
	readonly options: CliOptions;
}) {
	const preferences = createPreferenceStore();
	const [locale, setLocale] = useState<Locale>(props.initialLocale);
	const [translator, setTranslator] = useState<Translator>(() => props.initialTranslator);

	const handleLocaleChange = useCallback((next: Locale) => {
		void initI18n(next).then(instance => {
			setTranslator(() => createTranslator(instance));
			setLocale(next);
		});
	}, []);

	return (
		<App
			useCases={props.useCases}
			t={translator}
			locale={locale}
			onLocaleChange={handleLocaleChange}
			preferences={preferences}
			initialView={props.view}
			includeTasks={props.options.tasks === true}
			deep={props.options.deep === true}
			readOnly={props.options.readOnly === true}
			refreshIntervalMs={refreshIntervalMs(props.options)}
		/>
	);
}

async function launchInterface(view: View, options: CliOptions, useCases: UseCases): Promise<void> {
	const {t, locale} = await startSession(options);

	if (!process.stdout.isTTY) {
		throw new Error(t('cli.ttyError'));
	}

	const instance = render(
		<Root useCases={useCases} initialLocale={locale} initialTranslator={t} view={view} options={options} />,
		{exitOnCtrlC: true},
	);
	await instance.waitUntilExit();
}

/** Commands that open a view: they print with --list or --json, otherwise render. */
const VIEW_COMMANDS: ReadonlyArray<{
	readonly name: string;
	readonly view: View;
	readonly description: string;
	readonly report: (context: CommandContext) => Promise<void>;
	readonly isDefault?: boolean;
}> = [
	{
		name: 'startup',
		view: 'startup',
		description: 'inspect what starts with Windows',
		report: runStartupReport,
		isDefault: true,
	},
	{
		name: 'clean',
		view: 'residue',
		description: 'find and remove uninstall leftovers',
		report: runCleanReport,
	},
	{name: 'junk', view: 'junk', description: 'find and clear caches and junk files', report: runJunkReport},
	{
		name: 'hardware',
		view: 'hardware',
		description: 'inspect graphics, drivers, WSL and capabilities',
		report: runHardwareReport,
	},
];

function buildProgram(useCases: UseCases): Command {
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
			`limit a leftover scan to one class (${RESIDUE_CLASSES.join(', ')})`,
			(value: string, previous: string[]) => [...previous, value],
			[] as string[],
		);

	// Every option above belongs to the program, so `rux junk --help` would
	// otherwise list none of them. A footer points at the full list instead of
	// repeating the block on each command, which would drift on the next option.
	program.addHelpText(
		'afterAll',
		'\nOptions are global: they work before or after a command, and "rux --help" lists them all.\n',
	);

	const context = (): CommandContext => ({useCases, options: program.opts<CliOptions>(), print});

	for (const command of VIEW_COMMANDS) {
		program
			.command(command.name, command.isDefault === true ? {isDefault: true} : {})
			.description(command.description)
			.action(async () => {
				const options = program.opts<CliOptions>();
				if (isNonInteractive(options)) await command.report(context());
				else await launchInterface(command.view, options, useCases);
			});
	}

	program
		.command('backups')
		.description('list the backups rux can restore from')
		.action(async () => {
			await runBackupsReport(context());
		});

	program
		.command('restore')
		.argument('<id>', 'backup id')
		.description('restore a backup')
		.action(async (id: string) => {
			const restored = await runRestore(context(), id);
			if (!restored) process.exitCode = 1;
		});

	program
		.command('purge')
		.argument('<id>', 'backup id')
		.description('delete a backup permanently')
		.action(async (id: string) => {
			await runPurge(context(), id);
		});

	return program;
}

async function main(): Promise<void> {
	if (process.platform !== 'win32') {
		throw new Error('rux supports Windows only.');
	}
	await buildProgram(createApplication()).parseAsync(process.argv);
}

main().catch((error: unknown) => {
	console.error(`rux: ${describeError(error)}`);
	process.exit(1);
});
