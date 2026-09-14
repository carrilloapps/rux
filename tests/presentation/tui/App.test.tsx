import {beforeAll, describe, expect, it, vi} from 'vitest';
import {render} from 'ink-testing-library';
import {createUseCases} from '@/application/use-cases';
import {createTranslator, initI18n, type Locale, type Translator} from '@/i18n/translator';
import {App} from '@/presentation/tui/App';
import type {PreferenceStore} from '@/presentation/config';
import {aJunkFinding, aJunkTarget, aProcess, aRawStartupEntry, aResidueFinding} from '../../helpers/builders';
import {
	fakeJunkCleanPort,
	fakeJunkScanPort,
	fakePorts,
	fakeResidueRemovalPort,
	fakeResidueScanPort,
	fakeStartupInventoryPort,
	fakeStartupMutationPort,
} from '../../helpers/fakes';

const ESCAPE = '\u001B';
const BACKSPACE = '\u0008';
const ENTER = '\r';
const TAB = '\t';

let t: Translator;

beforeAll(async () => {
	t = createTranslator(await initI18n('en-US'));
});

type Frame = () => string | undefined;
type Stdin = {write: (data: string) => void};

/**
 * Waits for a condition rather than for a fixed delay.
 *
 * Scans resolve on the microtask queue and Ink repaints on its own schedule, so
 * a fixed sleep is both slower than it needs to be and flaky under load.
 */
async function waitFor(assertion: () => void): Promise<void> {
	const deadline = Date.now() + 3000;
	let lastError: unknown;
	for (;;) {
		try {
			assertion();
			return;
		} catch (error) {
			lastError = error;
			if (Date.now() > deadline) throw lastError;
			await new Promise<void>(resolve => setTimeout(resolve, 15));
		}
	}
}

const expectFrame = (frame: Frame, text: string) => waitFor(() => expect(frame() ?? '').toContain(text));
const expectNoFrame = (frame: Frame, text: string) =>
	waitFor(() => expect(frame() ?? '').not.toContain(text));

/**
 * Sends one character per write, letting Ink process each before the next.
 *
 * A multi-character write is not equivalent: Ink treats a burst as one chunk
 * and does not deliver every character as its own key event, so typing has to
 * be simulated the way a person types.
 */
async function press(stdin: Stdin, ...keys: string[]): Promise<void> {
	for (const key of keys) {
		for (const character of [...key]) {
			stdin.write(character);
			await new Promise<void>(resolve => setTimeout(resolve, 5));
		}
	}
}

function preferences(): PreferenceStore & {readonly saved: Locale[]} {
	const saved: Locale[] = [];
	return {
		saved,
		getLocale: () => 'en-US',
		setLocale: locale => saved.push(locale),
		path: '(test)',
	};
}

function mount(
	overrides: Parameters<typeof fakePorts>[0] = {},
	props: Partial<Parameters<typeof App>[0]> = {},
) {
	const store = preferences();
	const instance = render(
		<App
			useCases={createUseCases(fakePorts(overrides))}
			t={t}
			locale="en-US"
			onLocaleChange={props.onLocaleChange ?? (() => undefined)}
			preferences={store}
			initialView={props.initialView ?? 'startup'}
			includeTasks={props.includeTasks ?? false}
			deep={props.deep ?? false}
			readOnly={props.readOnly ?? false}
			refreshIntervalMs={props.refreshIntervalMs ?? 0}
		/>,
	);
	return {...instance, store};
}

const populated = () =>
	fakePorts({
		startupInventory: fakeStartupInventoryPort(
			[aRawStartupEntry(), aRawStartupEntry({id: 'b', name: 'Second', enabled: false})],
			[aProcess()],
		),
		residueScan: fakeResidueScanPort([aResidueFinding(), aResidueFinding({id: 'r2', risk: 'review'})]),
		junkScan: fakeJunkScanPort([aJunkFinding(), aJunkFinding({target: aJunkTarget({id: 'npm-cache'})})]),
	});

describe('App', () => {
	it('shows a scanning message until the first inventory lands', () => {
		expect(mount().lastFrame()).toContain('Scanning');
	});

	it('renders the startup view once loaded', async () => {
		const {lastFrame} = mount(populated());

		await expectFrame(lastFrame, '2 entries');
		expect(lastFrame()).toContain('Startup');
		expect(lastFrame()).toContain('App');
	});

	it('reports a fatal scan failure instead of an empty interface', async () => {
		const {lastFrame} = mount({
			startupInventory: {
				readStartupEntries: () => Promise.reject(new Error('registry unreadable')),
				readProcesses: () => Promise.resolve([]),
			},
		});

		await expectFrame(lastFrame, 'registry unreadable');
	});

	describe('navigation', () => {
		it('moves the cursor and jumps to the ends', async () => {
			const {stdin, lastFrame} = mount(populated());
			await expectFrame(lastFrame, '2 entries');

			await press(stdin, 'j');
			await expectFrame(lastFrame, 'Second');

			await press(stdin, 'G', 'g');
			await expectFrame(lastFrame, 'App');
		});

		it('switches views with tab, loading each on first visit', async () => {
			const {stdin, lastFrame} = mount(populated());
			await expectFrame(lastFrame, '2 entries');

			await press(stdin, TAB);
			await expectFrame(lastFrame, '2 leftovers');

			await press(stdin, TAB);
			await expectFrame(lastFrame, 'reclaimable');

			await press(stdin, TAB);
			await expectFrame(lastFrame, 'Recommendations');
		});

		it('opens and closes the help overlay', async () => {
			const {stdin, lastFrame} = mount(populated());
			await expectFrame(lastFrame, '2 entries');

			await press(stdin, '?');
			await expectFrame(lastFrame, 'Keys');

			await press(stdin, '?');
			await expectNoFrame(lastFrame, 'cycle sort');
		});
	});

	describe('search', () => {
		/**
		 * The summary counts the machine, not the view, so filtering is asserted
		 * through the detail panel, which always describes the highlighted row.
		 */
		const selectedRow = (frame: string) => frame.split('\n').find(line => line.includes('Run (user)')) ?? '';

		it('filters the list as the query is typed', async () => {
			const {stdin, lastFrame} = mount(populated());
			await expectFrame(lastFrame, '2 entries');
			expect(selectedRow(lastFrame() ?? '')).toContain('App');

			await press(stdin, '/', 'Second');
			await expectFrame(lastFrame, '/Second');
			await waitFor(() => expect(selectedRow(lastFrame() ?? '')).toContain('Second'));
		});

		it('keeps the query when the search is accepted', async () => {
			const {stdin, lastFrame} = mount(populated());
			await expectFrame(lastFrame, '2 entries');

			await press(stdin, '/', 'Second');
			await expectFrame(lastFrame, '/Second');

			await press(stdin, ENTER);
			await expectNoFrame(lastFrame, '/Second');
			expect(selectedRow(lastFrame() ?? '')).toContain('Second');
		});

		it('clears the query on escape', async () => {
			const {stdin, lastFrame} = mount(populated());
			await expectFrame(lastFrame, '2 entries');

			// Escape only clears the query once search mode is active; in list
			// mode it quits, so wait for the prompt before sending it.
			await press(stdin, '/', 'Second');
			await expectFrame(lastFrame, '/Second');

			await press(stdin, ESCAPE);
			await expectNoFrame(lastFrame, '/Second');
			await waitFor(() => expect(selectedRow(lastFrame() ?? '')).toContain('App'));
		});

		it('supports backspace', async () => {
			const {stdin, lastFrame} = mount(populated());
			await expectFrame(lastFrame, '2 entries');

			await press(stdin, '/', 'Sec', BACKSPACE);
			await expectFrame(lastFrame, '/Se');
		});
	});

	describe('startup actions', () => {
		it('cycles the filter and the sort', async () => {
			const {stdin, lastFrame} = mount(populated());
			await expectFrame(lastFrame, 'all/status');

			await press(stdin, 'f');
			await expectFrame(lastFrame, 'running/status');

			await press(stdin, 's');
			await expectFrame(lastFrame, 'running/name');

			await press(stdin, 'F');
			await expectFrame(lastFrame, 'all/name');
		});

		it('reloads with scheduled tasks included', async () => {
			const port = fakeStartupInventoryPort([aRawStartupEntry()], [aProcess()]);
			const {stdin, lastFrame} = mount({startupInventory: port});
			await expectFrame(lastFrame, '1 entries');

			await press(stdin, 't');
			await expectFrame(lastFrame, '+tasks');

			expect(port.calls).toEqual([false, true]);
		});

		it('confirms before disabling an entry, and applies it', async () => {
			const mutation = fakeStartupMutationPort();
			const {stdin, lastFrame} = mount({
				startupInventory: fakeStartupInventoryPort([aRawStartupEntry()], [aProcess()]),
				startupMutation: mutation,
			});
			await expectFrame(lastFrame, '1 entries');

			await press(stdin, ' ');
			await expectFrame(lastFrame, 'Disable "App"');

			await press(stdin, 'y');
			await waitFor(() => expect(mutation.calls[0]?.mutation).toBe('disable'));
		});

		it('cancels a pending action on n', async () => {
			const mutation = fakeStartupMutationPort();
			const {stdin, lastFrame} = mount({
				startupInventory: fakeStartupInventoryPort([aRawStartupEntry()], [aProcess()]),
				startupMutation: mutation,
			});
			await expectFrame(lastFrame, '1 entries');

			await press(stdin, 'd');
			await expectFrame(lastFrame, 'Remove "App"');

			await press(stdin, 'n');
			await expectFrame(lastFrame, 'Cancelled');
			expect(mutation.calls).toHaveLength(0);
		});

		it('refuses to toggle an entry Windows tracks no flag for', async () => {
			const {stdin, lastFrame} = mount({
				startupInventory: fakeStartupInventoryPort(
					[aRawStartupEntry({source: 'run-once-user', approvalKey: null})],
					[],
				),
			});
			await expectFrame(lastFrame, '1 entries');

			await press(stdin, ' ');
			await expectFrame(lastFrame, 'cannot be toggled');
		});

		it('blocks every mutation in read-only mode', async () => {
			const mutation = fakeStartupMutationPort();
			const {stdin, lastFrame} = mount(
				{
					startupInventory: fakeStartupInventoryPort([aRawStartupEntry()], []),
					startupMutation: mutation,
				},
				{readOnly: true},
			);
			await expectFrame(lastFrame, '1 entries');

			await press(stdin, ' ', 'd');
			expect(mutation.calls).toHaveLength(0);
		});

		it('surfaces a mutation failure', async () => {
			const {stdin, lastFrame} = mount({
				startupInventory: fakeStartupInventoryPort([aRawStartupEntry()], []),
				startupMutation: fakeStartupMutationPort(new Error('access denied')),
			});
			await expectFrame(lastFrame, '1 entries');

			await press(stdin, ' ', 'y');
			await expectFrame(lastFrame, 'access denied');
		});
	});

	describe('selection views', () => {
		it('selects safe items, everything, and nothing', async () => {
			const {stdin, lastFrame} = mount(populated(), {initialView: 'residue'});
			await expectFrame(lastFrame, '2 leftovers');

			await press(stdin, 'a');
			await expectFrame(lastFrame, '1 selected');

			await press(stdin, 'A');
			await expectFrame(lastFrame, '2 selected');

			await press(stdin, 'n');
			await expectFrame(lastFrame, '0 selected');
		});

		it('filters leftovers by their title and evidence', async () => {
			const {stdin, lastFrame} = mount(
				{
					startupInventory: fakeStartupInventoryPort([aRawStartupEntry()], []),
					residueScan: fakeResidueScanPort([
						aResidueFinding(),
						aResidueFinding({id: 'r2', title: 'Phantom Service', evidence: 'C:/Gone/phantom.exe'}),
					]),
				},
				{initialView: 'residue'},
			);
			await expectFrame(lastFrame, '2 leftovers');

			await press(stdin, '/', 'Phantom');
			await expectFrame(lastFrame, '/Phantom');
			await waitFor(() => expect(lastFrame() ?? '').not.toContain('Ghost'));
		});

		it('toggles a single row with space', async () => {
			const {stdin, lastFrame} = mount(populated(), {initialView: 'residue'});
			await expectFrame(lastFrame, '2 leftovers');

			await press(stdin, ' ');
			await expectFrame(lastFrame, '1 selected');

			await press(stdin, ' ');
			await expectFrame(lastFrame, '0 selected');
		});

		it('says so when asked to act with nothing selected', async () => {
			const {stdin, lastFrame} = mount(populated(), {initialView: 'residue'});
			await expectFrame(lastFrame, '2 leftovers');

			await press(stdin, 'x');
			await expectFrame(lastFrame, 'Nothing selected');
		});

		it('removes the selected leftovers and reports the backup', async () => {
			const removal = fakeResidueRemovalPort({
				removed: 1,
				failed: 0,
				backupId: '20260914-000000-abcd',
				receipts: [],
			});
			const {stdin, lastFrame} = mount(
				{
					startupInventory: fakeStartupInventoryPort([aRawStartupEntry()], []),
					residueScan: fakeResidueScanPort([aResidueFinding()]),
					residueRemoval: removal,
				},
				{initialView: 'residue'},
			);
			await expectFrame(lastFrame, '1 leftovers');

			await press(stdin, 'a', 'x');
			await expectFrame(lastFrame, 'Remove 1 leftover?');

			await press(stdin, 'y');
			await expectFrame(lastFrame, '20260914-000000-abcd');
			expect(removal.calls).toHaveLength(1);
		});

		it('clears the selected junk and reports what it freed', async () => {
			const clean = fakeJunkCleanPort({cleared: 1, failed: 0, freedBytes: 4096, receipts: []});
			const {stdin, lastFrame} = mount(
				{
					startupInventory: fakeStartupInventoryPort([aRawStartupEntry()], []),
					junkScan: fakeJunkScanPort([aJunkFinding()]),
					junkClean: clean,
				},
				{initialView: 'junk'},
			);
			await expectFrame(lastFrame, '1 locations');

			await press(stdin, 'a', 'x');
			await expectFrame(lastFrame, 'Clear 1 location?');

			await press(stdin, 'y');
			await expectFrame(lastFrame, 'Freed 4.0 KB');
			expect(clean.calls).toHaveLength(1);
		});

		it('toggles the deep scan only in the leftovers view', async () => {
			const scan = fakeResidueScanPort([aResidueFinding()]);
			const {stdin, lastFrame} = mount(
				{startupInventory: fakeStartupInventoryPort([aRawStartupEntry()], []), residueScan: scan},
				{initialView: 'residue'},
			);
			await expectFrame(lastFrame, '1 leftovers');

			await press(stdin, 'D');
			await expectFrame(lastFrame, 'deep');
			expect(scan.calls.at(-1)?.deep).toBe(true);
		});

		it('blocks removal in read-only mode', async () => {
			const removal = fakeResidueRemovalPort();
			const {stdin, lastFrame} = mount(
				{
					startupInventory: fakeStartupInventoryPort([aRawStartupEntry()], []),
					residueScan: fakeResidueScanPort([aResidueFinding()]),
					residueRemoval: removal,
				},
				{initialView: 'residue', readOnly: true},
			);
			await expectFrame(lastFrame, '1 leftovers');

			await press(stdin, 'a', 'x');
			await expectFrame(lastFrame, 'read-only');
			expect(removal.calls).toHaveLength(0);
		});
	});

	describe('language', () => {
		it('switches locale, persists it and tells the caller', async () => {
			const onLocaleChange = vi.fn();
			const {stdin, lastFrame, store} = mount(populated(), {onLocaleChange});
			await expectFrame(lastFrame, '2 entries');

			await press(stdin, 'l');

			await waitFor(() => expect(store.saved).toEqual(['es-VE']));
			expect(onLocaleChange).toHaveBeenCalledWith('es-VE');
		});
	});

	describe('rescanning', () => {
		it('reloads the active view on r', async () => {
			const port = fakeStartupInventoryPort([aRawStartupEntry()], []);
			const {stdin, lastFrame} = mount({startupInventory: port});
			await expectFrame(lastFrame, '1 entries');

			await press(stdin, 'r');
			await waitFor(() => expect(port.calls.length).toBeGreaterThan(1));
		});

		it('polls the process table on an interval', async () => {
			const port = fakeStartupInventoryPort([aRawStartupEntry()], [aProcess()]);
			const {lastFrame} = mount({startupInventory: port}, {refreshIntervalMs: 20});
			await expectFrame(lastFrame, '1 entries');

			await waitFor(() => expect(port.processCalls.length).toBeGreaterThan(0));
		});
	});
});
