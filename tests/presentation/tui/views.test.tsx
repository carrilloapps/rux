import {beforeAll, describe, expect, it} from 'vitest';
import {render} from 'ink-testing-library';
import {bytes} from '@/domain/common';
import {createTranslator, initI18n, type Translator} from '@/i18n/translator';
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
import {
	aDisplay,
	aGraphicsController,
	aGraphicsProfile,
	aHardwareReport,
	aJunkFinding,
	aJunkTarget,
	aResidueFinding,
	aStartupEntry,
	capabilities,
} from '@tests/helpers/builders';

let t: Translator;

beforeAll(async () => {
	t = createTranslator(await initI18n('en-US'));
});

const frameOf = (element: Parameters<typeof render>[0]) => render(element).lastFrame() ?? '';

const noneChecked = new Set<string>();

/** Covers the narrow-terminal and fallback branches each table carries. */
describe('StartupList', () => {
	it('keeps the name column readable at a very narrow width', () => {
		const frame = frameOf(<StartupList entries={[aStartupEntry()]} cursor={0} height={5} width={40} t={t} />);
		expect(frame).toContain('App');
		expect(frame).not.toContain('SOURCE');
	});

	it('shows a dash instead of memory for an entry that is not running', () => {
		const frame = frameOf(
			<StartupList entries={[aStartupEntry({running: false})]} cursor={0} height={5} width={130} t={t} />,
		);
		expect(frame).toMatch(/stopped\s+-/);
	});

	it('falls back to a dash for an unknown publisher', () => {
		const frame = frameOf(
			<StartupList entries={[aStartupEntry({publisher: null})]} cursor={0} height={5} width={130} t={t} />,
		);
		expect(frame).toContain('-');
	});
});

describe('StartupDetail', () => {
	it('summarises a single process without pluralising', () => {
		const frame = frameOf(
			<StartupDetail
				entry={aStartupEntry({running: true, pids: [42], matchReason: 'path'})}
				width={110}
				t={t}
			/>,
		);
		expect(frame).toContain('1 process ');
		expect(frame).toContain('matched by exact path');
	});

	it('truncates a long process list rather than wrapping it', () => {
		const frame = frameOf(
			<StartupDetail
				entry={aStartupEntry({running: true, pids: [1, 2, 3, 4, 5, 6, 7, 8], matchReason: 'directory'})}
				width={110}
				t={t}
			/>,
		);
		expect(frame).toContain('8 processes');
	});

	it('says an entry is not running when nothing matched', () => {
		expect(frameOf(<StartupDetail entry={aStartupEntry()} width={110} t={t} />)).toContain('not running');
	});

	it('notes when Windows skips a disabled entry at logon', () => {
		const frame = frameOf(<StartupDetail entry={aStartupEntry({enabled: false})} width={110} t={t} />);
		expect(frame).toContain('startup skipped');
	});

	it('falls back for an unknown publisher and a missing executable path', () => {
		const frame = frameOf(
			<StartupDetail
				entry={aStartupEntry({publisher: null, executablePath: null, executableExists: false})}
				width={110}
				t={t}
			/>,
		);
		expect(frame).toContain('unknown');
	});
});

describe('ResidueList', () => {
	it('drops optional columns at a narrow width', () => {
		const frame = frameOf(
			<ResidueList
				findings={[aResidueFinding()]}
				checked={noneChecked}
				cursor={0}
				height={5}
				width={50}
				t={t}
			/>,
		);
		expect(frame).toContain('Ghost');
		expect(frame).not.toContain('KIND');
	});

	it('shows a size only when the finding has one', () => {
		const withSize = frameOf(
			<ResidueList
				findings={[aResidueFinding({sizeBytes: bytes(2048)})]}
				checked={noneChecked}
				cursor={0}
				height={5}
				width={130}
				t={t}
			/>,
		);
		expect(withSize).toContain('2.0 KB');
	});

	it('renders a finding with no evidence path', () => {
		const frame = frameOf(
			<ResidueList
				findings={[aResidueFinding({evidence: null})]}
				checked={noneChecked}
				cursor={0}
				height={5}
				width={130}
				t={t}
			/>,
		);
		expect(frame).toContain('Ghost');
	});
});

describe('ResidueDetail', () => {
	it('marks an item that needs administrator rights', () => {
		const frame = frameOf(
			<ResidueDetail finding={aResidueFinding({elevation: 'administrator'})} width={110} t={t} />,
		);
		expect(frame).toContain('needs admin');
	});

	it('explains the review risk differently from the safe one', () => {
		expect(frameOf(<ResidueDetail finding={aResidueFinding()} width={110} t={t} />)).toContain('safe -');
		expect(
			frameOf(<ResidueDetail finding={aResidueFinding({risk: 'review'})} width={110} t={t} />),
		).toContain('review -');
	});

	it('falls back to a dash when there is no evidence path', () => {
		expect(
			frameOf(<ResidueDetail finding={aResidueFinding({evidence: null})} width={110} t={t} />),
		).toContain('-');
	});
});

describe('JunkList', () => {
	it('drops the category column at a narrow width', () => {
		const frame = frameOf(
			<JunkList findings={[aJunkFinding()]} checked={noneChecked} cursor={0} height={5} width={60} t={t} />,
		);
		expect(frame).toContain('user-temp');
		expect(frame).not.toContain('CATEGORY');
	});

	it('marks a checked row', () => {
		const frame = frameOf(
			<JunkList
				findings={[aJunkFinding()]}
				checked={new Set(['user-temp'])}
				cursor={0}
				height={5}
				width={120}
				t={t}
			/>,
		);
		expect(frame).toContain('[x]');
	});
});

describe('JunkDetail', () => {
	it('marks a location that needs administrator rights', () => {
		const frame = frameOf(
			<JunkDetail
				finding={aJunkFinding({target: aJunkTarget({elevation: 'administrator'})})}
				width={110}
				t={t}
			/>,
		);
		expect(frame).toContain('needs admin');
	});

	it('shows a partial-read note when one applies', () => {
		const frame = frameOf(
			<JunkDetail finding={aJunkFinding({note: {key: 'junk.notes.partialRead'}})} width={110} t={t} />,
		);
		expect(frame).toContain('Partially readable');
	});

	it('uses the review wording for a location that is not regenerated', () => {
		const frame = frameOf(
			<JunkDetail finding={aJunkFinding({target: aJunkTarget({risk: 'review'})})} width={110} t={t} />,
		);
		expect(frame).toContain('review -');
	});
});

describe('HardwareList', () => {
	const recommendation = {
		id: 'r1',
		area: 'system' as const,
		impact: 'critical' as const,
		title: {key: 'recommendations.system.secureBootOff.title'},
		finding: {key: 'recommendations.system.secureBootOff.finding'},
		advice: {key: 'recommendations.system.secureBootOff.advice'},
		action: null,
		evidence: [],
	};

	it('drops the area column at a narrow width', () => {
		const frame = frameOf(
			<HardwareList recommendations={[recommendation]} cursor={0} height={5} width={70} t={t} />,
		);
		expect(frame).toContain('critical');
		expect(frame).not.toContain('AREA');
	});
});

describe('HardwareDetail', () => {
	const report = aHardwareReport({
		graphics: aGraphicsProfile({
			controllers: [aGraphicsController()],
			displays: [aDisplay()],
		}),
		capabilities: capabilities(),
	});

	it('shows a recommendation without an action or evidence', () => {
		const frame = frameOf(
			<HardwareDetail
				item={{
					id: 'r1',
					area: 'driver',
					impact: 'info',
					title: {key: 'recommendations.driver.allHealthy.title'},
					finding: {key: 'recommendations.driver.allHealthy.finding', values: {count: 3}},
					advice: {key: 'recommendations.driver.allHealthy.advice'},
					action: null,
					evidence: [],
				}}
				report={report}
				width={110}
				t={t}
			/>,
		);

		expect(frame).toContain('healthy');
		expect(frame).not.toContain('Command');
	});

	it('shows an action whose location has no command', () => {
		const frame = frameOf(
			<HardwareDetail
				item={{
					id: 'r2',
					area: 'system',
					impact: 'medium',
					title: {key: 'recommendations.system.secureBootOff.title'},
					finding: {key: 'recommendations.system.secureBootOff.finding'},
					advice: {key: 'recommendations.system.secureBootOff.advice'},
					action: {location: {key: 'actions.firmwareSettings'}, command: null},
					evidence: ['SecureBoot: disabled'],
				}}
				report={report}
				width={110}
				t={t}
			/>,
		);

		expect(frame).toContain('Firmware setup');
		expect(frame).toContain('Evidence');
		expect(frame).not.toContain('Command ');
	});

	it('falls back to an overview when nothing is selected and a report exists', () => {
		const frame = frameOf(<HardwareDetail item={undefined} report={report} width={110} t={t} />);
		expect(frame).toContain('Intel Core i7');
	});

	it('says nothing is selected when there is no report either', () => {
		const frame = frameOf(<HardwareDetail item={undefined} report={null} width={110} t={t} />);
		expect(frame).toContain('Nothing selected');
	});

	it('handles a machine with no adapters in the overview', () => {
		const frame = frameOf(
			<HardwareDetail
				item={undefined}
				report={aHardwareReport({graphics: aGraphicsProfile({controllers: [], displays: []})})}
				width={110}
				t={t}
			/>,
		);
		expect(frame).toContain('-');
	});
});

describe('ResidueList at the narrowest usable width', () => {
	it('drops the evidence column entirely rather than truncating to nothing', () => {
		const frame = frameOf(
			<ResidueList
				findings={[aResidueFinding()]}
				checked={noneChecked}
				cursor={0}
				height={3}
				width={22}
				t={t}
			/>,
		);

		expect(frame).toContain('Ghost');
		expect(frame).not.toContain('C:');
	});
});
