import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Box, Text, useApp, useInput, type Key as InkKey} from 'ink';
import type {UseCases} from '@/application/use-cases';
import {canToggle, statusOf} from '@/domain/startup';
import {LOCALE_LABELS, nextLocale, type Locale, type Translator} from '@/i18n/translator';
import {describeError} from '@/shared/errors';
import {formatBytes} from '@/shared/format';
import type {PreferenceStore} from '@/presentation/config';
import {Header, HelpOverlay, Summary} from '@/presentation/tui/chrome';
import {keyBindingsFor} from '@/presentation/tui/keymap';
import {useScans} from '@/presentation/tui/use-scans';
import {useChecked, useCursors, useTerminalSize} from '@/presentation/tui/use-selection';
import {StatusBar, type Pending} from '@/presentation/tui/status-bar';
import {DetailPane, ViewBody, type ViewData} from '@/presentation/tui/view-body';
import {isSelectableView, nextView, type View} from '@/presentation/tui/view';

type Mode = 'list' | 'search' | 'confirm' | 'help';
type Tone = 'info' | 'error' | 'success';

const STARTUP_FILTERS = ['all', 'running', 'stopped', 'enabled', 'disabled', 'missing'] as const;
const STARTUP_SORTS = ['status', 'name', 'source', 'memory'] as const;

type StartupFilter = (typeof STARTUP_FILTERS)[number];
type StartupSort = (typeof STARTUP_SORTS)[number];

const STATUS_ORDER: Readonly<Record<string, number>> = Object.freeze({
	running: 0,
	stopped: 1,
	disabled: 2,
	missing: 3,
});

export interface AppProps {
	readonly useCases: UseCases;
	readonly t: Translator;
	readonly locale: Locale;
	readonly onLocaleChange: (locale: Locale) => void;
	readonly preferences: PreferenceStore;
	readonly initialView: View;
	readonly includeTasks: boolean;
	readonly deep: boolean;
	readonly readOnly: boolean;
	readonly refreshIntervalMs: number;
}

function cycle<T>(values: readonly T[], current: T, direction: 1 | -1): T {
	const index = values.indexOf(current);
	return values[(index + direction + values.length) % values.length] as T;
}

/**
 * Composes the interface.
 *
 * State that is not about rendering lives in hooks: scan results in `useScans`,
 * cursors and checkboxes in `use-selection`. What stays here is the mode the
 * user is in, the startup view's own filter and sort, and the key handling that
 * ties them together.
 */
export function App(props: AppProps) {
	const {useCases, t, locale, onLocaleChange, preferences, readOnly, refreshIntervalMs} = props;
	const {exit} = useApp();
	const {columns, rows} = useTerminalSize();

	const [view, setView] = useState<View>(props.initialView);
	const [mode, setMode] = useState<Mode>('list');
	const [pending, setPending] = useState<Pending | null>(null);
	const [busy, setBusy] = useState(false);
	const [status, setStatus] = useState<{text: string; tone: Tone} | null>(null);

	const [query, setQuery] = useState('');
	const [filter, setFilter] = useState<StartupFilter>('all');
	const [sort, setSort] = useState<StartupSort>('status');
	const [includeTasks, setIncludeTasks] = useState(props.includeTasks);
	const [deep, setDeep] = useState(props.deep);

	// Holds the live key handler so the function Ink subscribes to never changes.
	const handlerRef = useRef<(input: string, key: InkKey) => void>(() => undefined);

	const reportError = useCallback((message: string) => {
		setStatus({text: message, tone: 'error'});
	}, []);

	const scans = useScans(useCases, reportError);
	const cursors = useCursors();
	const residueChecked = useChecked();
	const junkChecked = useChecked();

	const loadView = useCallback(
		async (target: View): Promise<void> => {
			switch (target) {
				case 'startup':
					return scans.loadStartup(includeTasks);
				case 'residue':
					residueChecked.clear();
					return scans.loadResidue(deep);
				case 'junk':
					junkChecked.clear();
					return scans.loadJunk();
				case 'hardware':
					return scans.loadHardware();
			}
		},
		[scans, includeTasks, deep, residueChecked, junkChecked],
	);

	const initialView = props.initialView;
	const initialTasks = props.includeTasks;
	const initialDeep = props.deep;

	// Each view loads once, on first visit, so opening rux stays fast.
	useEffect(() => {
		void scans.loadStartup(initialTasks);
		if (initialView === 'residue') void scans.loadResidue(initialDeep);
		if (initialView === 'junk') void scans.loadJunk();
		if (initialView === 'hardware') void scans.loadHardware();
		// Runs once on mount; every later load goes through a key handler.
	}, []);

	useEffect(() => {
		if (refreshIntervalMs <= 0 || view !== 'startup') return;
		const timer = setInterval(() => void scans.refreshProcesses(), refreshIntervalMs);
		return () => {
			clearInterval(timer);
		};
	}, [refreshIntervalMs, view, scans]);

	const startupEntries = useMemo(() => {
		if (!scans.inventory) return [];
		const needle = query.trim().toLowerCase();

		const matches = scans.inventory.entries.filter(entry => {
			const entryStatus = statusOf(entry);
			if (filter === 'running' && !entry.running) return false;
			if (filter === 'stopped' && (entry.running || !entry.enabled)) return false;
			if (filter === 'enabled' && !entry.enabled) return false;
			if (filter === 'disabled' && entry.enabled) return false;
			if (filter === 'missing' && entry.executableExists) return false;
			if (!needle) return true;
			return `${entry.name} ${entry.command} ${entry.publisher ?? ''} ${entryStatus}`
				.toLowerCase()
				.includes(needle);
		});

		return [...matches].sort((a, b) => {
			if (sort === 'name') return a.name.localeCompare(b.name);
			if (sort === 'source') return a.source.localeCompare(b.source) || a.name.localeCompare(b.name);
			if (sort === 'memory') return b.memoryBytes - a.memoryBytes || a.name.localeCompare(b.name);
			return (
				(STATUS_ORDER[statusOf(a)] ?? 9) - (STATUS_ORDER[statusOf(b)] ?? 9) || a.name.localeCompare(b.name)
			);
		});
	}, [scans.inventory, query, filter, sort]);

	const residueFindings = useMemo(() => {
		if (!scans.residue) return [];
		const needle = query.trim().toLowerCase();
		if (!needle) return scans.residue.findings;
		return scans.residue.findings.filter(finding =>
			`${finding.title} ${finding.evidence ?? ''}`.toLowerCase().includes(needle),
		);
	}, [scans.residue, query]);

	const junkFindings = useMemo(
		() => [...(scans.junk?.findings ?? [])].sort((a, b) => b.sizeBytes - a.sizeBytes),
		[scans.junk],
	);

	const recommendations = scans.hardware?.recommendations ?? [];

	const viewData: ViewData = {
		startup: startupEntries,
		residue: residueFindings,
		junk: junkFindings,
		hardware: recommendations,
	};

	const counts: Readonly<Record<View, number>> = {
		startup: startupEntries.length,
		residue: residueFindings.length,
		junk: junkFindings.length,
		hardware: recommendations.length,
	};

	const selectedStartup = startupEntries[cursors.indexFor('startup', counts.startup)];
	const selectedResidue = residueFindings[cursors.indexFor('residue', counts.residue)];
	const selectedJunk = junkFindings[cursors.indexFor('junk', counts.junk)];
	const selectedRecommendation = recommendations[cursors.indexFor('hardware', counts.hardware)];

	const checkedResidue = useMemo(
		() => residueFindings.filter(finding => residueChecked.has(finding.id)),
		[residueFindings, residueChecked],
	);
	const checkedJunk = useMemo(
		() => junkFindings.filter(finding => junkChecked.has(finding.target.id)),
		[junkFindings, junkChecked],
	);

	const runPending = useCallback(
		async (action: Pending) => {
			setBusy(true);
			try {
				if (action.kind === 'startup') {
					await useCases.mutateStartupEntry.execute(action.entry, action.mutation);
					setStatus({
						text: t('startup.mutated', {name: action.entry.name, mutation: action.mutation}),
						tone: 'success',
					});
					await scans.loadStartup(includeTasks);
					return;
				}

				if (action.kind === 'residue') {
					const result = await useCases.removeResidue.execute(
						action.findings,
						scans.residue?.elevated ?? false,
					);
					const parts = [t('residue.removed', {removed: result.removed, total: action.findings.length})];
					if (result.failed > 0) parts.push(t('residue.removeFailed', {count: result.failed}));
					if (result.backupId) parts.push(t('residue.backupCreated', {id: result.backupId}));
					setStatus({text: parts.join(' '), tone: result.failed > 0 ? 'error' : 'success'});
					residueChecked.clear();
					await scans.loadResidue(deep);
					await scans.loadStartup(includeTasks);
					return;
				}

				const result = await useCases.cleanJunk.execute(action.findings, scans.junk?.elevated ?? false);
				const parts = [t('junk.freed', {size: formatBytes(result.freedBytes), count: result.cleared})];
				if (result.failed > 0) parts.push(t('junk.cleanFailed', {count: result.failed}));
				setStatus({text: parts.join(' '), tone: result.failed > 0 ? 'error' : 'success'});
				junkChecked.clear();
				await scans.loadJunk();
			} catch (error) {
				reportError(describeError(error));
			} finally {
				setBusy(false);
			}
		},
		[useCases, t, scans, includeTasks, deep, residueChecked, junkChecked, reportError],
	);

	const switchView = useCallback(
		(direction: 1 | -1) => {
			const target = nextView(view, direction);
			setView(target);
			setQuery('');
			if (!scans.hasLoaded(target) && scans.loading[target] !== true) void loadView(target);
		},
		[view, scans, loadView],
	);

	const toggleLanguage = useCallback(() => {
		const next = nextLocale(locale);
		preferences.setLocale(next);
		onLocaleChange(next);
		setStatus({text: `${t('app.language')}: ${LOCALE_LABELS[next]}`, tone: 'info'});
	}, [locale, preferences, onLocaleChange, t]);

	const handleStartupKey = useCallback(
		(input: string): void => {
			if (input === 'f' || input === 'F') {
				setFilter(current => cycle(STARTUP_FILTERS, current, input === 'f' ? 1 : -1));
				return;
			}
			if (input === 's') {
				setSort(current => cycle(STARTUP_SORTS, current, 1));
				return;
			}
			if (input === 't') {
				const next = !includeTasks;
				setIncludeTasks(next);
				void scans.loadStartup(next);
				return;
			}
			if (!selectedStartup) return;
			if (readOnly && (input === ' ' || input === 'd')) {
				reportError(t('app.readOnlyBadge'));
				return;
			}
			if (input === ' ') {
				if (!canToggle(selectedStartup)) {
					reportError(t('startup.cannotToggle', {source: t(`startup.source.${selectedStartup.source}`)}));
					return;
				}
				setPending({
					kind: 'startup',
					mutation: selectedStartup.enabled ? 'disable' : 'enable',
					entry: selectedStartup,
				});
				setMode('confirm');
				return;
			}
			if (input === 'd') {
				setPending({kind: 'startup', mutation: 'remove', entry: selectedStartup});
				setMode('confirm');
			}
		},
		[includeTasks, scans, selectedStartup, readOnly, reportError, t],
	);

	const handleSelectionKey = useCallback(
		(input: string, isReturn: boolean): void => {
			const forResidue = view === 'residue';
			const checked = forResidue ? residueChecked : junkChecked;
			const allIds = forResidue
				? residueFindings.map(finding => finding.id)
				: junkFindings.map(finding => finding.target.id);
			const safeIds = forResidue
				? residueFindings.filter(finding => finding.risk === 'safe').map(finding => finding.id)
				: junkFindings.filter(finding => finding.target.risk === 'safe').map(finding => finding.target.id);
			const currentId = forResidue ? selectedResidue?.id : selectedJunk?.target.id;

			if (input === ' ' && currentId) return checked.toggle(currentId);
			if (input === 'a') return checked.replace(safeIds);
			if (input === 'A') return checked.replace(allIds);
			if (input === 'n') return checked.clear();

			if (input === 'D' && forResidue) {
				const next = !deep;
				setDeep(next);
				void scans.loadResidue(next);
				return;
			}

			if (input === 'x' || isReturn) {
				if (readOnly) return reportError(t('app.readOnlyBadge'));
				const selection = forResidue ? checkedResidue : checkedJunk;
				if (selection.length === 0) return reportError(t('residue.selectHint'));
				setPending(
					forResidue ? {kind: 'residue', findings: checkedResidue} : {kind: 'junk', findings: checkedJunk},
				);
				setMode('confirm');
			}
		},
		[
			view,
			residueChecked,
			junkChecked,
			residueFindings,
			junkFindings,
			selectedResidue,
			selectedJunk,
			deep,
			scans,
			readOnly,
			checkedResidue,
			checkedJunk,
			reportError,
			t,
		],
	);

	/**
	 * Ink resubscribes its stdin listener whenever the handler identity changes,
	 * which is every render. A key pressed in the gap between unsubscribing and
	 * resubscribing is dropped, and a finishing scan produces a burst of renders.
	 * Holding the live handler in a ref keeps the subscribed function stable, so
	 * Ink subscribes once and no keystroke is lost.
	 */
	const handleKey = useCallback((input: string, key: InkKey) => {
		handlerRef.current(input, key);
	}, []);

	handlerRef.current = (input: string, key: InkKey) => {
		if (busy) return;

		if (mode === 'search') {
			if (key.escape) {
				setQuery('');
				setMode('list');
			} else if (key.return) {
				setMode('list');
			} else if (key.backspace || key.delete) {
				setQuery(current => current.slice(0, -1));
			} else if (input && !key.ctrl && !key.meta) {
				setQuery(current => current + input);
			}
			return;
		}

		if (mode === 'confirm') {
			if (input === 'y' || input === 'Y') {
				const action = pending;
				setPending(null);
				setMode('list');
				if (action) void runPending(action);
			} else if (input === 'n' || input === 'N' || key.escape) {
				setPending(null);
				setMode('list');
				setStatus({text: t('app.cancelled'), tone: 'info'});
			}
			return;
		}

		if (mode === 'help') {
			if (input === '?' || key.escape || input === 'q') setMode('list');
			return;
		}

		if (input === 'q' || key.escape || (key.ctrl && input === 'c')) return exit();
		if (key.tab) return switchView(key.shift ? -1 : 1);
		if (input === '?') return setMode('help');
		if (input === '/') return setMode('search');
		if (input === 'l') return toggleLanguage();

		const total = counts[view];
		if (key.downArrow || input === 'j') return cursors.move(view, 1, total);
		if (key.upArrow || input === 'k') return cursors.move(view, -1, total);
		if (key.pageDown) return cursors.move(view, 10, total);
		if (key.pageUp) return cursors.move(view, -10, total);
		if (input === 'g') return cursors.jump(view, 'first', total);
		if (input === 'G') return cursors.jump(view, 'last', total);
		if (input === 'r') return void loadView(view);

		if (view === 'startup') return handleStartupKey(input);
		if (isSelectableView(view)) handleSelectionKey(input, key.return);
	};

	useInput(handleKey);

	if (scans.fatal) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="red" bold>
					{t('app.name')}
				</Text>
				<Text>{scans.fatal}</Text>
			</Box>
		);
	}

	if (!scans.inventory) {
		return (
			<Box padding={1}>
				<Text>
					<Text color="cyan">{t('app.name')}</Text> {t('app.scanning')}
				</Text>
			</Box>
		);
	}

	const listHeight = Math.max(3, rows - 18);
	const width = columns - 2;
	const viewLoading = scans.loading[view] === true;

	return (
		<Box flexDirection="column" width={columns}>
			<Header
				view={view}
				locale={locale}
				elevated={scans.inventory.elevated}
				readOnly={readOnly}
				machineName={scans.inventory.machineName}
				t={t}
			/>

			<Summary
				view={view}
				inventory={scans.inventory}
				residue={scans.residue}
				junk={scans.junk}
				junkFindings={junkFindings}
				junkSelected={checkedJunk}
				hardware={scans.hardware}
				residueSelectedCount={residueChecked.checked.size}
				filter={filter}
				sort={sort}
				includeTasks={includeTasks}
				deep={deep}
				busy={viewLoading}
				t={t}
			/>

			{mode === 'help' ? (
				<HelpOverlay bindings={keyBindingsFor(view, t)} title={t('keys.title')} />
			) : (
				<ViewBody
					view={view}
					data={viewData}
					cursor={cursors.indexFor(view, counts[view])}
					residueChecked={residueChecked.checked}
					junkChecked={junkChecked.checked}
					loading={viewLoading}
					height={listHeight}
					width={width}
					t={t}
				/>
			)}

			<DetailPane
				view={view}
				startup={selectedStartup}
				residue={selectedResidue}
				junk={selectedJunk}
				recommendation={selectedRecommendation}
				hardware={scans.hardware}
				width={columns - 4}
				t={t}
			/>

			<StatusBar mode={mode} pending={pending} query={query} busy={busy} status={status} t={t} />
		</Box>
	);
}
