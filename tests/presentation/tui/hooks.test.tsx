import {describe, expect, it, vi} from 'vitest';
import {Text} from 'ink';
import {render} from 'ink-testing-library';
import {createUseCases} from '@/application/use-cases';
import {useScans} from '@/presentation/tui/use-scans';
import {useChecked, useCursors, useTerminalSize} from '@/presentation/tui/use-selection';
import type {ScanState} from '@/presentation/tui/use-scans';
import type {CheckedState, CursorState} from '@/presentation/tui/use-selection';
import {aRawStartupEntry, aProcess} from '@tests/helpers/builders';
import {fakePorts, fakeStartupInventoryPort} from '@tests/helpers/fakes';

/**
 * Hooks are exercised through a throwaway component, which is the only way to
 * run them with a real React scheduler. `capture` hands the hook value back to
 * the test so it can be driven directly.
 */
function harness<T>(useHook: () => T): {get: () => T; waitForUpdate: () => Promise<void>} {
	let current!: T;

	function Probe() {
		current = useHook();
		return <Text>probe</Text>;
	}

	render(<Probe />);
	return {
		get: () => current,
		waitForUpdate: () => new Promise<void>(resolve => setTimeout(resolve, 10)),
	};
}

describe('useCursors', () => {
	it('starts every view at the first row', () => {
		const {get} = harness<CursorState>(() => useCursors());
		expect(get().indexFor('startup', 5)).toBe(0);
		expect(get().indexFor('junk', 5)).toBe(0);
	});

	it('moves and clamps within the list', async () => {
		const {get, waitForUpdate} = harness<CursorState>(() => useCursors());

		get().move('startup', 3, 10);
		await waitForUpdate();
		expect(get().indexFor('startup', 10)).toBe(3);

		get().move('startup', 100, 10);
		await waitForUpdate();
		expect(get().indexFor('startup', 10)).toBe(9);

		get().move('startup', -100, 10);
		await waitForUpdate();
		expect(get().indexFor('startup', 10)).toBe(0);
	});

	it('jumps to the first and last row', async () => {
		const {get, waitForUpdate} = harness<CursorState>(() => useCursors());

		get().jump('residue', 'last', 7);
		await waitForUpdate();
		expect(get().indexFor('residue', 7)).toBe(6);

		get().jump('residue', 'first', 7);
		await waitForUpdate();
		expect(get().indexFor('residue', 7)).toBe(0);
	});

	it('keeps each view on its own cursor', async () => {
		const {get, waitForUpdate} = harness<CursorState>(() => useCursors());

		get().set('startup', 4);
		await waitForUpdate();

		expect(get().indexFor('startup', 10)).toBe(4);
		expect(get().indexFor('junk', 10)).toBe(0);
	});

	it('clamps on read when the list shrinks underneath the cursor', async () => {
		const {get, waitForUpdate} = harness<CursorState>(() => useCursors());

		get().set('junk', 9);
		await waitForUpdate();

		expect(get().indexFor('junk', 3)).toBe(2);
		expect(get().indexFor('junk', 0)).toBe(0);
	});
});

describe('useChecked', () => {
	it('starts empty', () => {
		const {get} = harness<CheckedState>(() => useChecked());
		expect(get().checked.size).toBe(0);
		expect(get().has('a')).toBe(false);
	});

	it('toggles an item on and off', async () => {
		const {get, waitForUpdate} = harness<CheckedState>(() => useChecked());

		get().toggle('a');
		await waitForUpdate();
		expect(get().has('a')).toBe(true);

		get().toggle('a');
		await waitForUpdate();
		expect(get().has('a')).toBe(false);
	});

	it('replaces and clears the whole selection', async () => {
		const {get, waitForUpdate} = harness<CheckedState>(() => useChecked());

		get().replace(['a', 'b', 'c']);
		await waitForUpdate();
		expect(get().checked.size).toBe(3);

		get().clear();
		await waitForUpdate();
		expect(get().checked.size).toBe(0);
	});
});

describe('useTerminalSize', () => {
	it('reports the current terminal dimensions', () => {
		const {get} = harness(() => useTerminalSize());
		expect(get().columns).toBeGreaterThan(0);
		expect(get().rows).toBeGreaterThan(0);
	});
});

describe('useScans', () => {
	const ports = () =>
		fakePorts({startupInventory: fakeStartupInventoryPort([aRawStartupEntry()], [aProcess()])});

	it('reports nothing loaded before a scan runs', () => {
		const {get} = harness<ScanState>(() => useScans(createUseCases(ports()), () => undefined));
		expect(get().inventory).toBeNull();
		expect(get().hasLoaded('startup')).toBe(false);
		expect(get().hasLoaded('residue')).toBe(false);
		expect(get().hasLoaded('junk')).toBe(false);
		expect(get().hasLoaded('hardware')).toBe(false);
	});

	it('loads each view independently', async () => {
		const {get, waitForUpdate} = harness<ScanState>(() => useScans(createUseCases(ports()), () => undefined));

		await get().loadStartup(false);
		await waitForUpdate();
		expect(get().hasLoaded('startup')).toBe(true);
		expect(get().hasLoaded('junk')).toBe(false);

		await get().loadJunk();
		await get().loadResidue(false);
		await get().loadHardware();
		await waitForUpdate();

		expect(get().hasLoaded('junk')).toBe(true);
		expect(get().hasLoaded('residue')).toBe(true);
		expect(get().hasLoaded('hardware')).toBe(true);
		expect(get().loading.startup).toBe(false);
	});

	it('records a startup failure as fatal, since there is nothing to render', async () => {
		const failing = fakePorts({
			startupInventory: {
				readStartupEntries: () => Promise.reject(new Error('registry unreadable')),
				readProcesses: () => Promise.resolve([]),
			},
		});
		const {get, waitForUpdate} = harness<ScanState>(() => useScans(createUseCases(failing), () => undefined));

		await get().loadStartup(false);
		await waitForUpdate();

		expect(get().fatal).toContain('registry unreadable');
	});

	it('reports a non-startup failure without going fatal', async () => {
		const onError = vi.fn();
		const failing = fakePorts({
			residueScan: {scan: () => Promise.reject(new Error('scan failed'))},
			junkScan: {measure: () => Promise.reject(new Error('measure failed'))},
			hardware: {inspect: () => Promise.reject(new Error('inspect failed'))},
		});
		const {get, waitForUpdate} = harness<ScanState>(() => useScans(createUseCases(failing), onError));

		await get().loadResidue(false);
		await get().loadJunk();
		await get().loadHardware();
		await waitForUpdate();

		expect(get().fatal).toBeNull();
		expect(onError).toHaveBeenCalledTimes(3);
		expect(onError).toHaveBeenCalledWith('scan failed');
	});

	it('does nothing when asked to refresh before the first scan', async () => {
		const port = fakeStartupInventoryPort([aRawStartupEntry()], [aProcess()]);
		const {get} = harness<ScanState>(() =>
			useScans(createUseCases(fakePorts({startupInventory: port})), () => undefined),
		);

		await get().refreshProcesses();

		expect(port.processCalls).toHaveLength(0);
	});

	it('refreshes the process table once an inventory exists', async () => {
		const port = fakeStartupInventoryPort([aRawStartupEntry()], [aProcess()]);
		const {get, waitForUpdate} = harness<ScanState>(() =>
			useScans(createUseCases(fakePorts({startupInventory: port})), () => undefined),
		);

		await get().loadStartup(false);
		await waitForUpdate();
		await get().refreshProcesses();
		await waitForUpdate();

		expect(port.processCalls).toHaveLength(1);
		expect(get().inventory?.entries[0]?.running).toBe(true);
	});

	it('swallows a failed poll rather than interrupting the interface', async () => {
		let first = true;
		const flaky = fakePorts({
			startupInventory: {
				readStartupEntries: async () => ({
					entries: [aRawStartupEntry()],
					processes: [],
					elevated: false,
					machineName: 'BOX',
					userName: 'u',
				}),
				readProcesses: () => {
					if (first) {
						first = false;
						return Promise.reject(new Error('transient'));
					}
					return Promise.resolve([]);
				},
			},
		});
		const {get, waitForUpdate} = harness<ScanState>(() => useScans(createUseCases(flaky), () => undefined));

		await get().loadStartup(false);
		await waitForUpdate();
		await expect(get().refreshProcesses()).resolves.toBeUndefined();
		expect(get().fatal).toBeNull();
	});
});
