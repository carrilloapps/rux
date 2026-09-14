import {beforeAll, describe, expect, it, vi} from 'vitest';
import {Text} from 'ink';
import {render} from 'ink-testing-library';
import {createTranslator, initI18n, type Translator} from '@/i18n/translator';
import {Summary} from '@/presentation/tui/chrome';
import {StatusBar} from '@/presentation/tui/status-bar';
import {useTerminalSize, type TerminalSize} from '@/presentation/tui/use-selection';
import {HardwareList, ResidueList, StartupDetail} from '@/presentation/tui/views';
import {DetailPane} from '@/presentation/tui/view-body';
import {aJunkFinding, aResidueFinding, aStartupEntry} from '@tests/helpers/builders';

let t: Translator;

beforeAll(async () => {
	t = createTranslator(await initI18n('en-US'));
});

const frameOf = (element: Parameters<typeof render>[0]) => render(element).lastFrame() ?? '';

const recommendation = (id: string) => ({
	id,
	area: 'system' as const,
	impact: 'low' as const,
	title: {key: 'recommendations.system.secureBootOff.title'},
	finding: {key: 'recommendations.system.secureBootOff.finding'},
	advice: {key: 'recommendations.system.secureBootOff.advice'},
	action: null,
	evidence: [],
});

describe('useTerminalSize', () => {
	it('follows the terminal as it is resized', async () => {
		let size: TerminalSize | undefined;

		function Probe() {
			size = useTerminalSize();
			return <Text>probe</Text>;
		}

		const {stdout} = render(<Probe />);
		expect(size?.columns).toBeGreaterThan(0);

		// The harness exposes the dimensions as accessors, so they are redefined
		// rather than assigned before the resize is announced.
		Object.defineProperty(stdout, 'columns', {value: 200, configurable: true});
		Object.defineProperty(stdout, 'rows', {value: 60, configurable: true});
		stdout.emit('resize');

		await vi.waitFor(() => {
			expect(size?.columns).toBe(200);
			expect(size?.rows).toBe(60);
		});
	});

	it('unsubscribes when the component goes away', async () => {
		function Probe() {
			useTerminalSize();
			return <Text>probe</Text>;
		}

		const {stdout, unmount} = render(<Probe />);
		const before = stdout.listenerCount('resize');
		unmount();
		await new Promise<void>(resolve => setTimeout(resolve, 20));

		expect(stdout.listenerCount('resize')).toBeLessThan(before);
	});
});

describe('Summary, hardware without a report', () => {
	it('omits the device count until the scan lands', () => {
		const frame = frameOf(
			<Summary
				view="hardware"
				inventory={null}
				residue={null}
				junk={null}
				junkFindings={[]}
				junkSelected={[]}
				hardware={null}
				residueSelectedCount={0}
				filter="all"
				sort="status"
				includeTasks={false}
				deep={false}
				busy={false}
				t={t}
			/>,
		);

		expect(frame).toContain('Recommendations');
		expect(frame).not.toContain('devices');
	});
});

describe('StatusBar plural forms', () => {
	it.each([
		[1, 'Clear 1 location?'],
		[3, 'Clear 3 locations?'],
	])('uses the right junk plural for %i', (count, expected) => {
		const frame = frameOf(
			<StatusBar
				mode="confirm"
				pending={{kind: 'junk', findings: Array.from({length: count}, () => aJunkFinding())}}
				query=""
				busy={false}
				status={null}
				t={t}
			/>,
		);
		expect(frame).toContain(expected);
	});

	it.each([['info' as const], ['success' as const], ['error' as const]])('renders a %s status', tone => {
		const frame = frameOf(
			<StatusBar mode="list" pending={null} query="" busy={false} status={{text: 'Done.', tone}} t={t} />,
		);
		expect(frame).toContain('Done.');
	});
});

describe('StartupDetail without a match reason', () => {
	it('omits the matched-by clause when nothing explains the match', () => {
		const frame = frameOf(
			<StartupDetail
				entry={aStartupEntry({running: true, pids: [7], matchReason: null})}
				width={110}
				t={t}
			/>,
		);

		expect(frame).toContain('1 process');
		expect(frame).not.toContain('matched by');
	});
});

describe('HardwareList scrolling', () => {
	it('shows a position indicator once the list exceeds the viewport', () => {
		const items = Array.from({length: 12}, (_value, index) => recommendation(`r${index}`));
		const frame = frameOf(<HardwareList recommendations={items} cursor={0} height={4} width={120} t={t} />);
		expect(frame).toContain('/ 12');
	});
});

describe('defensive fallbacks', () => {
	it('shows zero leftovers before the scan lands', () => {
		const frame = frameOf(
			<Summary
				view="residue"
				inventory={null}
				residue={null}
				junk={null}
				junkFindings={[]}
				junkSelected={[]}
				hardware={null}
				residueSelectedCount={0}
				filter="all"
				sort="status"
				includeTasks={false}
				deep={false}
				busy={false}
				t={t}
			/>,
		);

		expect(frame).toContain('0 leftovers');
	});

	it('renders the hardware detail before any report exists', () => {
		const frame = frameOf(
			<DetailPane
				view="hardware"
				startup={undefined}
				residue={undefined}
				junk={undefined}
				recommendation={undefined}
				hardware={null}
				width={110}
				t={t}
			/>,
		);

		expect(frame).toContain('Nothing selected');
	});

	it('renders a leftover row with no evidence on a wide terminal', () => {
		const frame = frameOf(
			<ResidueList
				findings={[aResidueFinding({evidence: null})]}
				checked={new Set<string>()}
				cursor={0}
				height={5}
				width={140}
				t={t}
			/>,
		);

		expect(frame).toContain('POINTS AT');
		expect(frame).toContain('Ghost');
	});
});
