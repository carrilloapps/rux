import {useCallback, useState} from 'react';
import type {UseCases} from '@/application/use-cases';
import type {HardwareAnalysis} from '@/application/use-cases';
import type {JunkReport} from '@/domain/junk';
import type {ResidueReport} from '@/domain/residue';
import {RESIDUE_CLASSES} from '@/domain/residue';
import type {StartupInventory} from '@/domain/startup';
import {describeError} from '@/shared/errors';
import type {View} from '@/presentation/tui/view';

export interface ScanState {
	readonly inventory: StartupInventory | null;
	readonly residue: ResidueReport | null;
	readonly junk: JunkReport | null;
	readonly hardware: HardwareAnalysis | null;
	readonly loading: Readonly<Partial<Record<View, boolean>>>;
	/** Set only when the startup scan fails, which leaves rux with nothing to show. */
	readonly fatal: string | null;
	loadStartup(includeTasks: boolean): Promise<void>;
	loadResidue(deep: boolean): Promise<void>;
	loadJunk(): Promise<void>;
	loadHardware(): Promise<void>;
	refreshProcesses(): Promise<void>;
	hasLoaded(view: View): boolean;
}

/**
 * Owns every scan result and the loading flags that go with them.
 *
 * Keeping this out of the component leaves the view free to be a rendering
 * concern, and makes the loading rules -- each view loads once, on first visit
 * -- readable in one place.
 */
export function useScans(useCases: UseCases, onError: (message: string) => void): ScanState {
	const [inventory, setInventory] = useState<StartupInventory | null>(null);
	const [residue, setResidue] = useState<ResidueReport | null>(null);
	const [junk, setJunk] = useState<JunkReport | null>(null);
	const [hardware, setHardware] = useState<HardwareAnalysis | null>(null);
	const [loading, setLoading] = useState<Partial<Record<View, boolean>>>({startup: true});
	const [fatal, setFatal] = useState<string | null>(null);

	const withLoading = useCallback(async (view: View, work: () => Promise<void>) => {
		setLoading(current => ({...current, [view]: true}));
		try {
			await work();
		} finally {
			setLoading(current => ({...current, [view]: false}));
		}
	}, []);

	const loadStartup = useCallback(
		(includeTasks: boolean) =>
			withLoading('startup', async () => {
				try {
					setInventory(await useCases.scanStartup.execute(includeTasks));
					setFatal(null);
				} catch (error) {
					// Without the startup inventory there is no interface to render.
					setFatal(describeError(error));
				}
			}),
		[useCases, withLoading],
	);

	const loadResidue = useCallback(
		(deep: boolean) =>
			withLoading('residue', async () => {
				try {
					setResidue(await useCases.scanResidue.execute(RESIDUE_CLASSES, deep));
				} catch (error) {
					onError(describeError(error));
				}
			}),
		[useCases, withLoading, onError],
	);

	const loadJunk = useCallback(
		() =>
			withLoading('junk', async () => {
				try {
					setJunk(await useCases.scanJunk.execute());
				} catch (error) {
					onError(describeError(error));
				}
			}),
		[useCases, withLoading, onError],
	);

	const loadHardware = useCallback(
		() =>
			withLoading('hardware', async () => {
				try {
					setHardware(await useCases.analyzeHardware.execute());
				} catch (error) {
					onError(describeError(error));
				}
			}),
		[useCases, withLoading, onError],
	);

	/** Re-reads only the process table, so the running column stays honest cheaply. */
	const refreshProcesses = useCallback(async () => {
		if (!inventory) return;
		try {
			setInventory(await useCases.refreshProcesses.execute(inventory));
		} catch {
			// A dropped poll is not worth interrupting the interface for.
		}
	}, [useCases, inventory]);

	const hasLoaded = useCallback(
		(view: View): boolean => {
			switch (view) {
				case 'startup':
					return inventory !== null;
				case 'residue':
					return residue !== null;
				case 'junk':
					return junk !== null;
				case 'hardware':
					return hardware !== null;
			}
		},
		[inventory, residue, junk, hardware],
	);

	return {
		inventory,
		residue,
		junk,
		hardware,
		loading,
		fatal,
		loadStartup,
		loadResidue,
		loadJunk,
		loadHardware,
		refreshProcesses,
		hasLoaded,
	};
}
