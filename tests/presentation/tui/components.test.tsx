import {beforeAll, describe, expect, it} from 'vitest';
import {render} from 'ink-testing-library';
import {bytes} from '@/domain/common';
import {createTranslator, initI18n, type Translator} from '@/i18n/translator';
import {
	Empty,
	Field,
	Panel,
	ScrollIndicator,
	TableHeader,
	visibleWindow,
} from '@/presentation/tui/components';
import {Header, HelpOverlay, Summary} from '@/presentation/tui/chrome';
import {keyBindingsFor} from '@/presentation/tui/keymap';
import {StatusBar} from '@/presentation/tui/status-bar';
import {DetailPane, ViewBody, countFor, type ViewData} from '@/presentation/tui/view-body';
import {VIEWS, VIEW_LABEL_KEY, isSelectableView, nextView} from '@/presentation/tui/view';
import {
	aHardwareReport,
	aJunkFinding,
	aJunkTarget,
	aResidueFinding,
	aStartupEntry,
} from '../../helpers/builders';

let t: Translator;

beforeAll(async () => {
	t = createTranslator(await initI18n('en-US'));
});

const emptyData: ViewData = {startup: [], residue: [], junk: [], hardware: []};

const fullData: ViewData = {
	startup: [aStartupEntry()],
	residue: [aResidueFinding()],
	junk: [aJunkFinding()],
	hardware: [
		{
			id: 'r1',
			area: 'graphics',
			impact: 'high',
			title: {key: 'recommendations.graphics.gameDvrEnabled.title'},
			finding: {key: 'recommendations.graphics.gameDvrEnabled.finding'},
			advice: {key: 'recommendations.graphics.gameDvrEnabled.advice'},
			action: {location: {key: 'actions.gameCaptureSettings'}, command: 'start ms-settings:gaming-gamedvr'},
			evidence: ['HKCU\\System\\GameConfigStore'],
		},
	],
};

describe('view', () => {
	it('cycles forwards and backwards through every view', () => {
		expect(nextView('startup', 1)).toBe('residue');
		expect(nextView('hardware', 1)).toBe('startup');
		expect(nextView('startup', -1)).toBe('hardware');
	});

	it('labels every view', () => {
		for (const view of VIEWS) {
			expect(VIEW_LABEL_KEY[view]).toMatch(/^views\./);
			expect(t(VIEW_LABEL_KEY[view])).not.toBe(VIEW_LABEL_KEY[view]);
		}
	});

	it('knows which views act on a selection', () => {
		expect(isSelectableView('residue')).toBe(true);
		expect(isSelectableView('junk')).toBe(true);
		expect(isSelectableView('startup')).toBe(false);
		expect(isSelectableView('hardware')).toBe(false);
	});
});

describe('visibleWindow', () => {
	const items = Array.from({length: 20}, (_value, index) => index);

	it('shows the whole list when it fits', () => {
		expect(visibleWindow(items.slice(0, 3), 0, 10)).toEqual({start: 0, slice: [0, 1, 2]});
	});

	it('centres the cursor once the list scrolls', () => {
		expect(visibleWindow(items, 10, 5).start).toBe(8);
	});

	it('does not scroll past the end', () => {
		expect(visibleWindow(items, 19, 5).start).toBe(15);
	});

	it('never produces a viewport smaller than one row', () => {
		expect(visibleWindow(items, 0, 0).slice).toHaveLength(1);
	});
});

describe('countFor', () => {
	it('counts the rows of each view', () => {
		expect(countFor('startup', fullData)).toBe(1);
		expect(countFor('residue', fullData)).toBe(1);
		expect(countFor('junk', fullData)).toBe(1);
		expect(countFor('hardware', fullData)).toBe(1);
	});
});

describe('keyBindingsFor', () => {
	it('gives every view the shared keys', () => {
		for (const view of VIEWS) {
			const keys = keyBindingsFor(view, t).map(binding => binding.keys);
			expect(keys).toContain('tab');
			expect(keys).toContain('q');
		}
	});

	it('adds the keys each view actually has', () => {
		expect(keyBindingsFor('startup', t).map(b => b.keys)).toContain('s');
		expect(keyBindingsFor('residue', t).map(b => b.keys)).toContain('D');
		expect(keyBindingsFor('junk', t).map(b => b.keys)).not.toContain('D');
		expect(keyBindingsFor('hardware', t).map(b => b.keys)).not.toContain('space');
	});

	it('translates every description', () => {
		for (const binding of keyBindingsFor('startup', t)) {
			expect(binding.description).not.toMatch(/^keys\./);
		}
	});
});

describe('primitives', () => {
	it('renders a labelled field', () => {
		const {lastFrame} = render(<Field label="Status" value="running" />);
		expect(lastFrame()).toContain('Status');
		expect(lastFrame()).toContain('running');
	});

	it('renders a panel with and without a title', () => {
		expect(render(<Panel title={<>Title</>}>{<>Body</>}</Panel>).lastFrame()).toContain('Title');
		expect(render(<Panel>{<>Body</>}</Panel>).lastFrame()).toContain('Body');
	});

	it('renders an empty state with an optional hint', () => {
		expect(render(<Empty message="Nothing here" />).lastFrame()).toContain('Nothing here');
		expect(render(<Empty message="Nothing" hint="Try D" />).lastFrame()).toContain('Try D');
	});

	it('renders a table header and a scroll indicator', () => {
		const header = render(<TableHeader columns={[{key: 'a', label: 'NAME', width: 10}]} />).lastFrame();
		expect(header).toContain('NAME');
		expect(render(<ScrollIndicator cursor={2} total={10} width={40} />).lastFrame()).toContain('3 / 10');
	});
});

describe('Header', () => {
	it('marks the active view and the privilege level', () => {
		const {lastFrame} = render(
			<Header view="junk" locale="en-US" elevated readOnly machineName="TESTBOX" t={t} />,
		);
		const frame = lastFrame() ?? '';

		expect(frame).toContain('rux');
		expect(frame).toContain('Junk');
		expect(frame).toContain('admin');
		expect(frame).toContain('read-only');
		expect(frame).toContain('TESTBOX');
	});

	it('shows the unprivileged badge when not elevated', () => {
		const {lastFrame} = render(
			<Header view="startup" locale="es-VE" elevated={false} readOnly={false} machineName="BOX" t={t} />,
		);
		expect(lastFrame()).toContain('user');
		expect(lastFrame()).not.toContain('read-only');
	});
});

describe('Summary', () => {
	// Built lazily: the translator is only available after beforeAll runs.
	const base = () =>
		({
			inventory: null,
			residue: null,
			junk: null,
			junkFindings: [],
			junkSelected: [],
			hardware: null,
			residueSelectedCount: 0,
			filter: 'all',
			sort: 'status',
			includeTasks: false,
			deep: false,
			busy: false,
			t,
		}) as const;

	it('renders nothing meaningful before a scan lands', () => {
		expect(render(<Summary view="startup" {...base()} />).lastFrame()).toBeDefined();
	});

	it('counts startup entries by status', () => {
		const inventory = {
			entries: [aStartupEntry({running: true}), aStartupEntry({id: 'b', enabled: false})],
			processes: [],
			elevated: false,
			machineName: 'BOX',
			userName: 'u',
			tasksIncluded: true,
			scannedAt: '2026-09-14T00:00:00.000Z',
		};

		const frame = render(
			<Summary view="startup" {...base()} inventory={inventory} includeTasks />,
		).lastFrame();

		expect(frame).toContain('2 entries');
		expect(frame).toContain('1 running');
		expect(frame).toContain('1 disabled');
		expect(frame).toContain('+tasks');
	});

	it('shows the leftover selection and deep mode', () => {
		const residue = {
			findings: [aResidueFinding()],
			classesScanned: ['startup' as const],
			deep: true,
			elevated: false,
			scannedAt: '2026-09-14T00:00:00.000Z',
		};

		const frame = render(
			<Summary view="residue" {...base()} residue={residue} residueSelectedCount={1} deep />,
		).lastFrame();

		expect(frame).toContain('1 leftovers');
		expect(frame).toContain('1 selected');
		expect(frame).toContain('deep');
	});

	it('totals reclaimable and selected junk', () => {
		const frame = render(
			<Summary
				view="junk"
				{...base()}
				junkFindings={[aJunkFinding({sizeBytes: bytes(4096)})]}
				junkSelected={[aJunkFinding({sizeBytes: bytes(1024)})]}
			/>,
		).lastFrame();

		expect(frame).toContain('4.0 KB reclaimable');
		expect(frame).toContain('1.0 KB selected');
	});

	it('counts hardware recommendations and devices', () => {
		const frame = render(
			<Summary
				view="hardware"
				{...base()}
				hardware={{report: aHardwareReport(), wsl: null, recommendations: fullData.hardware}}
			/>,
		).lastFrame();

		expect(frame).toContain('Recommendations');
		expect(frame).toContain('1 devices');
	});

	it('shows a refreshing marker while a scan runs', () => {
		expect(render(<Summary view="startup" {...base()} busy />).lastFrame()).toContain('refreshing');
	});
});

describe('HelpOverlay', () => {
	it('lists every binding', () => {
		const frame = render(<HelpOverlay title="Keys" bindings={keyBindingsFor('junk', t)} />).lastFrame();
		expect(frame).toContain('Keys');
		expect(frame).toContain('tab');
		expect(frame).toContain('x / enter');
	});
});

describe('ViewBody', () => {
	const props = () => ({
		data: fullData,
		cursor: 0,
		residueChecked: new Set<string>(),
		junkChecked: new Set<string>(),
		loading: false,
		height: 10,
		width: 120,
		t,
	});

	it.each(VIEWS)('renders the %s list', view => {
		expect(render(<ViewBody view={view} {...props()} />).lastFrame()).toBeTruthy();
	});

	it('shows a scanning message while a view has nothing yet', () => {
		const frame = render(<ViewBody view="junk" {...props()} data={emptyData} loading />).lastFrame();
		expect(frame).toContain('Scanning');
	});

	it('shows each empty state once a scan came back empty', () => {
		expect(render(<ViewBody view="startup" {...props()} data={emptyData} />).lastFrame()).toContain(
			'No entries match',
		);
		expect(render(<ViewBody view="residue" {...props()} data={emptyData} />).lastFrame()).toContain(
			'No leftovers found',
		);
		expect(render(<ViewBody view="junk" {...props()} data={emptyData} />).lastFrame()).toContain(
			'No junk found',
		);
		expect(render(<ViewBody view="hardware" {...props()} data={emptyData} />).lastFrame()).toContain(
			'No recommendations',
		);
	});

	it('marks a checked row', () => {
		const frame = render(
			<ViewBody view="residue" {...props()} residueChecked={new Set(['abc123'])} />,
		).lastFrame();
		expect(frame).toContain('[x]');
	});

	it('drops optional columns at a narrow width', () => {
		const wide = render(<ViewBody view="startup" {...props()} width={130} />).lastFrame() ?? '';
		const narrow = render(<ViewBody view="startup" {...props()} width={60} />).lastFrame() ?? '';
		expect(wide).toContain('PUBLISHER');
		expect(narrow).not.toContain('PUBLISHER');
	});

	it('shows a scroll indicator once the list exceeds the viewport', () => {
		const many = {
			...fullData,
			// Distinct ids: the list keys on the target id, as it does in production.
			junk: Array.from({length: 10}, (_value, index) =>
				aJunkFinding({target: aJunkTarget({id: `location-${index}`})}),
			),
		};
		const frame = render(<ViewBody view="junk" {...props()} data={many} height={3} />).lastFrame();
		expect(frame).toContain('/ 10');
	});
});

describe('DetailPane', () => {
	const props = () => ({
		startup: aStartupEntry(),
		residue: aResidueFinding(),
		junk: aJunkFinding(),
		recommendation: fullData.hardware[0],
		hardware: {report: aHardwareReport(), wsl: null, recommendations: fullData.hardware},
		width: 110,
		t,
	});

	it.each(VIEWS)('renders the %s detail', view => {
		expect(render(<DetailPane view={view} {...props()} />).lastFrame()).toBeTruthy();
	});

	it('explains that nothing is selected when the list is empty', () => {
		const frame = render(
			<DetailPane
				{...props()}
				view="startup"
				startup={undefined}
				residue={undefined}
				junk={undefined}
				recommendation={undefined}
			/>,
		).lastFrame();
		expect(frame).toContain('Nothing selected');
	});

	it('falls back to a system overview when no recommendation is selected', () => {
		const frame = render(<DetailPane {...props()} view="hardware" recommendation={undefined} />).lastFrame();
		expect(frame).toContain('System');
		expect(frame).toContain('Intel Core i7');
	});

	it('reports a missing executable in the startup detail', () => {
		const frame = render(
			<DetailPane {...props()} view="startup" startup={aStartupEntry({executableExists: false})} />,
		).lastFrame();
		expect(frame).toContain('missing on disk');
	});

	it('names the rule that matched a running process', () => {
		const frame = render(
			<DetailPane
				{...props()}
				view="startup"
				startup={aStartupEntry({running: true, pids: [1, 2], matchReason: 'name'})}
			/>,
		).lastFrame();
		expect(frame).toContain('matched by executable name');
		expect(frame).toContain('2 processes');
	});
});

describe('StatusBar', () => {
	it('shows the search buffer', () => {
		const frame = render(
			<StatusBar mode="search" pending={null} query="disc" busy={false} status={null} t={t} />,
		).lastFrame();
		expect(frame).toContain('/disc');
	});

	it('asks for confirmation before a startup mutation', () => {
		const frame = render(
			<StatusBar
				mode="confirm"
				pending={{kind: 'startup', mutation: 'remove', entry: aStartupEntry()}}
				query=""
				busy={false}
				status={null}
				t={t}
			/>,
		).lastFrame();
		expect(frame).toContain('Remove "App"');
	});

	it.each([
		[1, 'Remove 1 leftover?'],
		[2, 'Remove 2 leftovers?'],
	])('uses the right plural for %i leftovers', (count, expected) => {
		const frame = render(
			<StatusBar
				mode="confirm"
				pending={{kind: 'residue', findings: Array.from({length: count}, () => aResidueFinding())}}
				query=""
				busy={false}
				status={null}
				t={t}
			/>,
		).lastFrame();
		expect(frame).toContain(expected);
		expect(frame).toContain('Backed up first');
	});

	it('warns that junk cleaning is not reversible', () => {
		const frame = render(
			<StatusBar
				mode="confirm"
				pending={{kind: 'junk', findings: [aJunkFinding()]}}
				query=""
				busy={false}
				status={null}
				t={t}
			/>,
		).lastFrame();
		expect(frame).toContain('Clear 1 location?');
		expect(frame).toContain('not backed up');
	});

	it('shows progress, then the result, then the hints', () => {
		expect(
			render(<StatusBar mode="list" pending={null} query="" busy status={null} t={t} />).lastFrame(),
		).toContain('working');

		expect(
			render(
				<StatusBar
					mode="list"
					pending={null}
					query=""
					busy={false}
					status={{text: 'Removed 1 of 1.', tone: 'success'}}
					t={t}
				/>,
			).lastFrame(),
		).toContain('Removed 1 of 1.');

		expect(
			render(<StatusBar mode="list" pending={null} query="" busy={false} status={null} t={t} />).lastFrame(),
		).toContain('switch view');
	});
});
