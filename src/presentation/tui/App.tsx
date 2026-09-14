import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Box, Text, useApp, useInput, useStdout} from 'ink';
import type {UseCases} from '@/application/use-cases';
import type {HardwareAnalysis} from '@/application/use-cases';
import type {JunkFinding, JunkReport} from '@/domain/junk';
import type {ResidueFinding, ResidueReport} from '@/domain/residue';
import {RESIDUE_CLASSES} from '@/domain/residue';
import type {StartupEntry, StartupInventory} from '@/domain/startup';
import {canToggle, statusOf} from '@/domain/startup';
import {LOCALE_LABELS, nextLocale, setLocale, type Locale, type Translator} from '@/i18n/translator';
import {describeError} from '@/shared/errors';
import {formatBytes} from '@/shared/format';
import type {PreferenceStore} from '@/presentation/config';
import {
	HardwareDetail,
	HardwareList,
	JunkDetail,
	JunkList,
	ResidueDetail,
	ResidueList,
	StartupDetail,
	StartupList,
} from '@/presentation/tui/views';

export type View = 'startup' | 'residue' | 'junk' | 'hardware';
const VIEWS: readonly View[] = ['startup', 'residue', 'junk', 'hardware'];

/** View ids are internal; the label keys read naturally in both languages. */
const VIEW_LABEL_KEY: Readonly<Record<View, string>> = Object.freeze({
	startup: 'views.startup',
	residue: 'views.leftovers',
	junk: 'views.junk',
	hardware: 'views.hardware',
});

type Mode = 'list' | 'search' | 'confirm' | 'help';

type Pending =
	| {kind: 'startup'; mutation: 'enable' | 'disable' | 'remove'; entry: StartupEntry}
	| {kind: 'residue'; findings: readonly ResidueFinding[]}
	| {kind: 'junk'; findings: readonly JunkFinding[]};

type Tone = 'info' | 'error' | 'success';

const STARTUP_FILTERS = ['all', 'running', 'stopped', 'enabled', 'disabled', 'missing'] as const;
const STARTUP_SORTS = ['status', 'name', 'source', 'memory'] as const;

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

function useTerminalSize() {
	const {stdout} = useStdout();
	const [size, setSize] = useState({columns: stdout?.columns ?? 100, rows: stdout?.rows ?? 30});

	useEffect(() => {
		if (!stdout) return;
		const onResize = () => setSize({columns: stdout.columns ?? 100, rows: stdout.rows ?? 30});
		stdout.on('resize', onResize);
		return () => {
			stdout.off('resize', onResize);
		};
	}, [stdout]);

	return size;
}

export function App(props: AppProps) {
	const {useCases, t, locale, onLocaleChange, preferences, readOnly, refreshIntervalMs} = props;
	const {exit} = useApp();
	const {columns, rows} = useTerminalSize();

	const [view, setView] = useState<View>(props.initialView);
	const [mode, setMode] = useState<Mode>('list');
	const [pending, setPending] = useState<Pending | null>(null);
	const [busy, setBusy] = useState(false);
	const [status, setStatus] = useState<{text: string; tone: Tone} | null>(null);
	const [fatal, setFatal] = useState<string | null>(null);

	const [inventory, setInventory] = useState<StartupInventory | null>(null);
	const [residue, setResidue] = useState<ResidueReport | null>(null);
	const [junk, setJunk] = useState<JunkReport | null>(null);
	const [hardware, setHardware] = useState<HardwareAnalysis | null>(null);

	const [loading, setLoading] = useState<Partial<Record<View, boolean>>>({startup: true});
	const [cursors, setCursors] = useState<Record<View, number>>({
		startup: 0,
		residue: 0,
		junk: 0,
		hardware: 0,
	});
	const [query, setQuery] = useState('');
	const [filter, setFilter] = useState<(typeof STARTUP_FILTERS)[number]>('all');
	const [sort, setSort] = useState<(typeof STARTUP_SORTS)[number]>('status');
	const [includeTasks, setIncludeTasks] = useState(props.includeTasks);
	const [deep, setDeep] = useState(props.deep);
	const [checkedResidue, setCheckedResidue] = useState<ReadonlySet<string>>(new Set());
	const [checkedJunk, setCheckedJunk] = useState<ReadonlySet<string>>(new Set());

	const selectedStartupId = useRef<string | null>(null);

	const setViewLoading = useCallback((target: View, value: boolean) => {
		setLoading(current => ({...current, [target]: value}));
	}, []);

	const setCursor = useCallback((target: View, updater: (current: number) => number) => {
		setCursors(current => ({...current, [target]: Math.max(0, updater(current[target]))}));
	}, []);

	const loadStartup = useCallback(
		async (tasks: boolean, note?: string) => {
			setViewLoading('startup', true);
			try {
				setInventory(await useCases.scanStartup.execute(tasks));
				setFatal(null);
				if (note) setStatus({text: note, tone: 'info'});
			} catch (error) {
				setFatal(describeError(error));
			} finally {
				setViewLoading('startup', false);
			}
		},
		[useCases, setViewLoading],
	);

	const loadResidue = useCallback(
		async (useDeep: boolean) => {
			setViewLoading('residue', true);
			try {
				setResidue(await useCases.scanResidue.execute(RESIDUE_CLASSES, useDeep));
				setCheckedResidue(new Set());
			} catch (error) {
				setStatus({text: describeError(error), tone: 'error'});
			} finally {
				setViewLoading('residue', false);
			}
		},
		[useCases, setViewLoading],
	);

	const loadJunk = useCallback(async () => {
		setViewLoading('junk', true);
		try {
			setJunk(await useCases.scanJunk.execute());
			setCheckedJunk(new Set());
		} catch (error) {
			setStatus({text: describeError(error), tone: 'error'});
		} finally {
			setViewLoading('junk', false);
		}
	}, [useCases, setViewLoading]);

	const loadHardware = useCallback(async () => {
		setViewLoading('hardware', true);
		try {
			setHardware(await useCases.analyzeHardware.execute());
		} catch (error) {
			setStatus({text: describeError(error), tone: 'error'});
		} finally {
			setViewLoading('hardware', false);
		}
	}, [useCases, setViewLoading]);

	// Each view loads on first visit, so opening rux stays fast.
	useEffect(() => {
		void loadStartup(includeTasks);
		if (props.initialView === 'residue') void loadResidue(deep);
		if (props.initialView === 'junk') void loadJunk();
		if (props.initialView === 'hardware') void loadHardware();
	}, []);

	// Only the startup view shows live process state, so only it polls.
	useEffect(() => {
		if (refreshIntervalMs <= 0 || view !== 'startup') return;
		const timer = setInterval(() => {
			void (async () => {
				try {
					setInventory(current => {
						if (current) void useCases.refreshProcesses.execute(current).then(setInventory);
						return current;
					});
				} catch {
					/* a dropped poll is not worth interrupting the UI for */
				}
			})();
		}, refreshIntervalMs);
		return () => clearInterval(timer);
	}, [refreshIntervalMs, view, useCases]);

	const startupEntries = useMemo(() => {
		if (!inventory) return [];
		const needle = query.trim().toLowerCase();
		const filtered = inventory.entries.filter(entry => {
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

		const order: Record<string, number> = {running: 0, stopped: 1, disabled: 2, missing: 3};
		return [...filtered].sort((a, b) => {
			if (sort === 'name') return a.name.localeCompare(b.name);
			if (sort === 'source') return a.source.localeCompare(b.source) || a.name.localeCompare(b.name);
			if (sort === 'memory') return b.memoryBytes - a.memoryBytes || a.name.localeCompare(b.name);
			return (order[statusOf(a)] ?? 9) - (order[statusOf(b)] ?? 9) || a.name.localeCompare(b.name);
		});
	}, [inventory, query, filter, sort]);

	const residueFindings = useMemo(() => {
		if (!residue) return [];
		const needle = query.trim().toLowerCase();
		if (!needle) return residue.findings;
		return residue.findings.filter(finding =>
			`${finding.title} ${finding.evidence ?? ''}`.toLowerCase().includes(needle),
		);
	}, [residue, query]);

	const junkFindings = useMemo(() => {
		if (!junk) return [];
		return [...junk.findings].sort((a, b) => b.sizeBytes - a.sizeBytes);
	}, [junk]);

	const recommendations = hardware?.recommendations ?? [];

	// Keep the highlighted startup entry stable across refreshes.
	useEffect(() => {
		const previous = selectedStartupId.current;
		if (!previous) return;
		const index = startupEntries.findIndex(entry => entry.id === previous);
		if (index >= 0) setCursor('startup', () => index);
	}, [startupEntries, setCursor]);

	const startupCursor = Math.min(cursors.startup, Math.max(0, startupEntries.length - 1));
	const residueCursor = Math.min(cursors.residue, Math.max(0, residueFindings.length - 1));
	const junkCursor = Math.min(cursors.junk, Math.max(0, junkFindings.length - 1));
	const hardwareCursor = Math.min(cursors.hardware, Math.max(0, recommendations.length - 1));

	const selectedStartup = startupEntries[startupCursor];
	const selectedResidue = residueFindings[residueCursor];
	const selectedJunk = junkFindings[junkCursor];
	const selectedRecommendation = recommendations[hardwareCursor];

	useEffect(() => {
		selectedStartupId.current = selectedStartup?.id ?? null;
	}, [selectedStartup]);

	const checkedResidueFindings = useMemo(
		() => (residue?.findings ?? []).filter(finding => checkedResidue.has(finding.id)),
		[residue, checkedResidue],
	);
	const checkedJunkFindings = useMemo(
		() => junkFindings.filter(finding => checkedJunk.has(finding.target.id)),
		[junkFindings, checkedJunk],
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
					await loadStartup(includeTasks);
				} else if (action.kind === 'residue') {
					const result = await useCases.removeResidue.execute(action.findings, residue?.elevated ?? false);
					const parts = [t('residue.removed', {removed: result.removed, total: action.findings.length})];
					if (result.failed > 0) parts.push(t('residue.removeFailed', {count: result.failed}));
					if (result.backupId) parts.push(t('residue.backupCreated', {id: result.backupId}));
					setStatus({text: parts.join(' '), tone: result.failed > 0 ? 'error' : 'success'});
					await loadResidue(deep);
					await loadStartup(includeTasks);
				} else {
					const result = await useCases.cleanJunk.execute(action.findings, junk?.elevated ?? false);
					const parts = [t('junk.freed', {size: formatBytes(result.freedBytes), count: result.cleared})];
					if (result.failed > 0) parts.push(t('junk.cleanFailed', {count: result.failed}));
					setStatus({text: parts.join(' '), tone: result.failed > 0 ? 'error' : 'success'});
					await loadJunk();
				}
			} catch (error) {
				setStatus({text: describeError(error), tone: 'error'});
			} finally {
				setBusy(false);
			}
		},
		[useCases, t, includeTasks, deep, residue, junk, loadStartup, loadResidue, loadJunk],
	);

	const switchView = useCallback(
		(direction: 1 | -1) => {
			const index = VIEWS.indexOf(view);
			const next = VIEWS[(index + direction + VIEWS.length) % VIEWS.length]!;
			setView(next);
			setQuery('');
			if (next === 'residue' && !residue && !loading.residue) void loadResidue(deep);
			if (next === 'junk' && !junk && !loading.junk) void loadJunk();
			if (next === 'hardware' && !hardware && !loading.hardware) void loadHardware();
		},
		[view, residue, junk, hardware, loading, deep, loadResidue, loadJunk, loadHardware],
	);

	const toggleLanguage = useCallback(() => {
		const next = nextLocale(locale);
		void setLocale(next).then(() => {
			preferences.setLocale(next);
			onLocaleChange(next);
			setStatus({text: `${t('app.language')}: ${LOCALE_LABELS[next]}`, tone: 'info'});
		});
	}, [locale, preferences, onLocaleChange, t]);

	const currentCount =
		view === 'startup'
			? startupEntries.length
			: view === 'residue'
				? residueFindings.length
				: view === 'junk'
					? junkFindings.length
					: recommendations.length;

	useInput((input, key) => {
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

		const move = (delta: number) =>
			setCursor(view, current => Math.max(0, Math.min(currentCount - 1, current + delta)));

		if (key.downArrow || input === 'j') return move(1);
		if (key.upArrow || input === 'k') return move(-1);
		if (key.pageDown) return move(10);
		if (key.pageUp) return move(-10);
		if (input === 'g') return setCursor(view, () => 0);
		if (input === 'G') return setCursor(view, () => Math.max(0, currentCount - 1));

		if (input === 'r') {
			if (view === 'startup') return void loadStartup(includeTasks);
			if (view === 'residue') return void loadResidue(deep);
			if (view === 'junk') return void loadJunk();
			return void loadHardware();
		}

		if (view === 'startup') {
			if (input === 'f' || input === 'F') {
				const step = input === 'f' ? 1 : STARTUP_FILTERS.length - 1;
				return setFilter(
					current => STARTUP_FILTERS[(STARTUP_FILTERS.indexOf(current) + step) % STARTUP_FILTERS.length]!,
				);
			}
			if (input === 's') {
				return setSort(
					current => STARTUP_SORTS[(STARTUP_SORTS.indexOf(current) + 1) % STARTUP_SORTS.length]!,
				);
			}
			if (input === 't') {
				const next = !includeTasks;
				setIncludeTasks(next);
				return void loadStartup(next);
			}
			if (!selectedStartup) return;
			if (readOnly && (input === ' ' || input === 'd')) {
				return setStatus({text: t('app.readOnlyBadge'), tone: 'error'});
			}
			if (input === ' ') {
				if (!canToggle(selectedStartup)) {
					return setStatus({
						text: t('startup.cannotToggle', {source: t(`startup.source.${selectedStartup.source}`)}),
						tone: 'error',
					});
				}
				setPending({
					kind: 'startup',
					mutation: selectedStartup.enabled ? 'disable' : 'enable',
					entry: selectedStartup,
				});
				return setMode('confirm');
			}
			if (input === 'd') {
				setPending({kind: 'startup', mutation: 'remove', entry: selectedStartup});
				return setMode('confirm');
			}
			return;
		}

		if (view === 'hardware') return;

		// Selection-based views: leftovers and junk.
		const isResidue = view === 'residue';
		const ids = isResidue ? residueFindings.map(f => f.id) : junkFindings.map(f => f.target.id);
		const safeIds = isResidue
			? residueFindings.filter(f => f.risk === 'safe').map(f => f.id)
			: junkFindings.filter(f => f.target.risk === 'safe').map(f => f.target.id);
		const setChecked = isResidue ? setCheckedResidue : setCheckedJunk;
		const currentId = isResidue ? selectedResidue?.id : selectedJunk?.target.id;

		if (input === ' ' && currentId) {
			return setChecked(current => {
				const next = new Set(current);
				if (next.has(currentId)) next.delete(currentId);
				else next.add(currentId);
				return next;
			});
		}
		if (input === 'a') return setChecked(new Set(safeIds));
		if (input === 'A') return setChecked(new Set(ids));
		if (input === 'n') return setChecked(new Set());
		if (input === 'D' && isResidue) {
			const next = !deep;
			setDeep(next);
			return void loadResidue(next);
		}
		if (input === 'x' || key.return) {
			if (readOnly) return setStatus({text: t('app.readOnlyBadge'), tone: 'error'});
			const selection = isResidue ? checkedResidueFindings : checkedJunkFindings;
			if (selection.length === 0) return setStatus({text: t('residue.selectHint'), tone: 'error'});
			setPending(
				isResidue
					? {kind: 'residue', findings: checkedResidueFindings}
					: {kind: 'junk', findings: checkedJunkFindings},
			);
			return setMode('confirm');
		}
	});

	if (fatal) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="red" bold>
					{t('app.name')}
				</Text>
				<Text>{fatal}</Text>
			</Box>
		);
	}

	if (loading.startup && !inventory) {
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
	const viewLoading = loading[view] === true;

	const helpRows: Array<[string, string]> = [
		['tab', t('keys.switchView')],
		['up down / j k', t('keys.move')],
		['g / G', t('keys.firstLast')],
		['/', t('keys.search')],
		...(view === 'startup'
			? ([
					['f / F', t('keys.filter')],
					['s', t('keys.sort')],
					['space', t('keys.toggleEntry')],
					['d', t('keys.removeEntry')],
					['t', t('keys.includeTasks')],
				] as Array<[string, string]>)
			: view === 'hardware'
				? []
				: ([
						['space', t('keys.select')],
						['a', t('keys.selectSafe')],
						['A', t('keys.selectAll')],
						['n', t('keys.selectNone')],
						['x / enter', t('keys.apply')],
						...(view === 'residue' ? ([['D', t('keys.deepScan')]] as Array<[string, string]>) : []),
					] as Array<[string, string]>)),
		['r', t('keys.rescan')],
		['l', t('keys.language')],
		['?', t('keys.help')],
		['q', t('keys.quit')],
	];

	return (
		<Box flexDirection="column" width={columns}>
			<Box paddingX={1} justifyContent="space-between">
				<Text>
					<Text color="cyan" bold>
						{t('app.name')}
					</Text>
					<Text dimColor> </Text>
					{VIEWS.map((candidate, index) => (
						<Text key={candidate}>
							{index > 0 ? <Text dimColor> | </Text> : null}
							<Text color={view === candidate ? 'cyan' : undefined} bold={view === candidate}>
								{t(VIEW_LABEL_KEY[candidate])}
							</Text>
						</Text>
					))}
					{inventory?.elevated ? (
						<Text color="green"> [{t('app.elevatedBadge')}]</Text>
					) : (
						<Text dimColor> [{t('app.userBadge')}]</Text>
					)}
					{readOnly ? <Text color="yellow"> [{t('app.readOnlyBadge')}]</Text> : null}
				</Text>
				<Text dimColor>
					{LOCALE_LABELS[locale]} {inventory?.machineName ?? ''}
				</Text>
			</Box>

			<Box paddingX={1}>
				<Text>
					{view === 'startup' && inventory ? (
						<Text>
							<Text bold>{t('startup.summary', {total: inventory.entries.length})}</Text>
							<Text dimColor> - </Text>
							<Text color="green">
								{t('startup.running', {count: inventory.entries.filter(e => e.running && e.enabled).length})}
							</Text>
							<Text dimColor> - </Text>
							<Text color="yellow">
								{t('startup.disabled', {count: inventory.entries.filter(e => !e.enabled).length})}
							</Text>
							<Text dimColor> - </Text>
							<Text color="red">
								{t('startup.missing', {count: inventory.entries.filter(e => !e.executableExists).length})}
							</Text>
							<Text dimColor>
								{'  '}
								{filter}/{sort}
								{includeTasks ? ' +tasks' : ''}
							</Text>
						</Text>
					) : view === 'residue' ? (
						<Text>
							<Text bold>{t('residue.summary', {total: residue?.findings.length ?? 0})}</Text>
							<Text dimColor> - </Text>
							<Text color="cyan">{t('residue.selected', {count: checkedResidue.size})}</Text>
							{deep ? <Text dimColor> deep</Text> : null}
						</Text>
					) : view === 'junk' ? (
						<Text>
							<Text bold>{t('junk.summary', {total: junkFindings.length})}</Text>
							<Text dimColor> - </Text>
							<Text color="green">
								{t('junk.reclaimable', {
									size: formatBytes(junkFindings.reduce((s, f) => s + f.sizeBytes, 0)),
								})}
							</Text>
							<Text dimColor> - </Text>
							<Text color="cyan">
								{t('junk.selectedSize', {
									size: formatBytes(checkedJunkFindings.reduce((s, f) => s + f.sizeBytes, 0)),
								})}
							</Text>
						</Text>
					) : (
						<Text>
							<Text bold>{t('hardware.recommendations')}</Text>
							<Text dimColor> - </Text>
							<Text>{recommendations.length}</Text>
							{hardware ? (
								<Text dimColor>
									{'  '}
									{t('hardware.deviceCount', {count: hardware.report.drivers.length})}
								</Text>
							) : null}
						</Text>
					)}
					{viewLoading ? <Text dimColor> - {t('app.refreshing')}</Text> : null}
				</Text>
			</Box>

			{mode === 'help' ? (
				<Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginX={1}>
					<Text bold color="cyan">
						{t('keys.title')}
					</Text>
					{helpRows.map(([keys, description]) => (
						<Box key={keys}>
							<Box width={16}>
								<Text color="yellow">{keys}</Text>
							</Box>
							<Text dimColor>{description}</Text>
						</Box>
					))}
				</Box>
			) : viewLoading && currentCount === 0 ? (
				<Box paddingX={1} paddingY={1}>
					<Text color="cyan">{t('app.scanning')}</Text>
				</Box>
			) : view === 'startup' ? (
				<StartupList
					entries={startupEntries}
					cursor={startupCursor}
					height={listHeight}
					width={width}
					t={t}
				/>
			) : view === 'residue' ? (
				<ResidueList
					findings={residueFindings}
					checked={checkedResidue}
					cursor={residueCursor}
					height={listHeight}
					width={width}
					t={t}
				/>
			) : view === 'junk' ? (
				<JunkList
					findings={junkFindings}
					checked={checkedJunk}
					cursor={junkCursor}
					height={listHeight}
					width={width}
					t={t}
				/>
			) : (
				<HardwareList
					recommendations={recommendations}
					cursor={hardwareCursor}
					height={listHeight}
					width={width}
					t={t}
				/>
			)}

			<Box paddingX={1} flexDirection="column">
				{view === 'startup' ? (
					<StartupDetail entry={selectedStartup} width={columns - 4} t={t} />
				) : view === 'residue' ? (
					<ResidueDetail finding={selectedResidue} width={columns - 4} t={t} />
				) : view === 'junk' ? (
					<JunkDetail finding={selectedJunk} width={columns - 4} t={t} />
				) : (
					<HardwareDetail
						item={selectedRecommendation}
						report={hardware?.report ?? null}
						width={columns - 4}
						t={t}
					/>
				)}
			</Box>

			<Box paddingX={1}>
				{mode === 'search' ? (
					<Text>
						<Text color="cyan">/</Text>
						{query}
						<Text color="cyan">_</Text>
					</Text>
				) : mode === 'confirm' && pending ? (
					<Text>
						<Text color="red" bold>
							{pending.kind === 'startup'
								? t(`startup.confirm.${pending.mutation}`, {name: pending.entry.name})
								: pending.kind === 'residue'
									? t(
											pending.findings.length === 1 ? 'residue.confirmRemove' : 'residue.confirmRemovePlural',
											{count: pending.findings.length},
										)
									: t(pending.findings.length === 1 ? 'junk.confirmClean' : 'junk.confirmCleanPlural', {
											count: pending.findings.length,
										})}
						</Text>
						<Text dimColor>
							{' '}
							{pending.kind === 'residue'
								? t('residue.backedUpFirst')
								: pending.kind === 'junk'
									? t('junk.notReversible')
									: ''}
						</Text>
						<Text> </Text>
						<Text color="green">y</Text>
						<Text dimColor> / </Text>
						<Text color="red">n</Text>
					</Text>
				) : busy ? (
					<Text color="cyan">{t('app.working')}</Text>
				) : status ? (
					<Text color={status.tone === 'error' ? 'red' : status.tone === 'success' ? 'green' : undefined}>
						{status.text}
					</Text>
				) : (
					<Text dimColor>
						tab {t('keys.switchView')} - / {t('app.help')} - l {t('keys.language')} - ? {t('app.help')} - q{' '}
						{t('app.quit')}
					</Text>
				)}
			</Box>
		</Box>
	);
}
