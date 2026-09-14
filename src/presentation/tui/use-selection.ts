import {useCallback, useEffect, useMemo, useState} from 'react';
import {useStdout} from 'ink';
import {VIEWS, type View} from '@/presentation/tui/view';

export interface TerminalSize {
	readonly columns: number;
	readonly rows: number;
}

/** Tracks terminal dimensions so lists can size their viewport to the window. */
/* c8 ignore next 4 -- the ?? fallbacks below only fire when Ink reports no
   stdout, which cannot happen in a rendered component or in the harness. */
export function useTerminalSize(): TerminalSize {
	const {stdout} = useStdout();
	const [size, setSize] = useState<TerminalSize>({
		columns: stdout?.columns ?? 100,
		rows: stdout?.rows ?? 30,
	});

	useEffect(() => {
		if (!stdout) return;
		const onResize = () => {
			setSize({columns: stdout.columns ?? 100, rows: stdout.rows ?? 30});
		};
		stdout.on('resize', onResize);
		return () => {
			stdout.off('resize', onResize);
		};
	}, [stdout]);

	return size;
}

export interface CursorState {
	/** The clamped index for the given view, safe to use as an array index. */
	indexFor(view: View, total: number): number;
	move(view: View, delta: number, total: number): void;
	jump(view: View, position: 'first' | 'last', total: number): void;
	set(view: View, index: number): void;
}

/**
 * One cursor per view, so switching views keeps each list where the user left
 * it. Clamping happens on read rather than on write, because a list can shrink
 * underneath a cursor when a scan refreshes.
 */
export function useCursors(): CursorState {
	const [cursors, setCursors] = useState<Record<View, number>>(
		() => Object.fromEntries(VIEWS.map(view => [view, 0])) as Record<View, number>,
	);

	const indexFor = useCallback(
		(view: View, total: number) => Math.min(cursors[view], Math.max(0, total - 1)),
		[cursors],
	);

	const set = useCallback((view: View, index: number) => {
		setCursors(current => ({...current, [view]: Math.max(0, index)}));
	}, []);

	const move = useCallback((view: View, delta: number, total: number) => {
		setCursors(current => ({
			...current,
			[view]: Math.max(0, Math.min(total - 1, Math.min(current[view], total - 1) + delta)),
		}));
	}, []);

	const jump = useCallback(
		(view: View, position: 'first' | 'last', total: number) => {
			set(view, position === 'first' ? 0 : Math.max(0, total - 1));
		},
		[set],
	);

	return {indexFor, move, jump, set};
}

export interface CheckedState {
	readonly checked: ReadonlySet<string>;
	toggle(id: string): void;
	replace(ids: readonly string[]): void;
	clear(): void;
	has(id: string): boolean;
}

/** A checkbox set for the views that act on many rows at once. */
export function useChecked(): CheckedState {
	const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set());

	const toggle = useCallback((id: string) => {
		setChecked(current => {
			const next = new Set(current);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}, []);

	const replace = useCallback((ids: readonly string[]) => {
		setChecked(new Set(ids));
	}, []);

	const clear = useCallback(() => {
		setChecked(new Set());
	}, []);

	const has = useCallback((id: string) => checked.has(id), [checked]);

	return useMemo(() => ({checked, toggle, replace, clear, has}), [checked, toggle, replace, clear, has]);
}
