import type {ReactNode} from 'react';
import {Box, Text} from 'ink';
import {pad, truncate} from '@/shared/format';

/**
 * Status marks use geometric characters rather than emoji: emoji render at
 * inconsistent widths across Windows terminals and break column alignment.
 */
export const MARKS = {
	running: '+',
	stopped: 'o',
	disabled: 'x',
	missing: '!',
	selected: '[x]',
	unselected: '[ ]',
	cursor: '>',
} as const;

export const IMPACT_COLORS: Readonly<Record<string, string>> = Object.freeze({
	critical: 'red',
	high: 'redBright',
	medium: 'yellow',
	low: 'cyan',
	info: 'gray',
});

export const RISK_COLORS: Readonly<Record<string, string>> = Object.freeze({
	safe: 'green',
	review: 'yellow',
	sensitive: 'red',
});

export const STATUS_COLORS: Readonly<Record<string, string>> = Object.freeze({
	running: 'green',
	stopped: 'gray',
	disabled: 'yellow',
	missing: 'red',
});

export interface Column {
	readonly key: string;
	readonly label: string;
	readonly width: number;
	readonly align?: 'left' | 'right';
}

export function TableHeader({columns, indent = 4}: {columns: readonly Column[]; indent?: number}) {
	return (
		<Box paddingX={1}>
			<Text dimColor bold>
				{' '.repeat(indent)}
				{columns.map(column => pad(column.label, column.width)).join('')}
			</Text>
		</Box>
	);
}

export function Field({
	label,
	value,
	color,
	width = 14,
}: {
	label: string;
	value: string;
	color?: string;
	width?: number;
}) {
	return (
		<Box>
			<Box width={width}>
				<Text dimColor>{label}</Text>
			</Box>
			<Text color={color}>{value}</Text>
		</Box>
	);
}

export function Panel({title, color, children}: {title?: ReactNode; color?: string; children: ReactNode}) {
	return (
		<Box flexDirection="column" borderStyle="round" borderColor={color ?? 'gray'} paddingX={1}>
			{title ? <Box>{title}</Box> : null}
			{children}
		</Box>
	);
}

export function Empty({message, hint}: {message: string; hint?: string}) {
	return (
		<Box paddingX={1} paddingY={1} flexDirection="column">
			<Text color="green">{message}</Text>
			{hint ? <Text dimColor>{hint}</Text> : null}
		</Box>
	);
}

export function ScrollIndicator({cursor, total, width}: {cursor: number; total: number; width: number}) {
	return (
		<Box paddingX={1}>
			<Text dimColor>{truncate(`-- ${cursor + 1} / ${total} --`, width)}</Text>
		</Box>
	);
}

/** Centres the cursor once a list is longer than the viewport. */
export function visibleWindow<T>(
	items: readonly T[],
	cursor: number,
	height: number,
): {start: number; slice: T[]} {
	const viewport = Math.max(1, height);
	let start = Math.max(0, cursor - Math.floor(viewport / 2));
	start = Math.min(start, Math.max(0, items.length - viewport));
	return {start, slice: items.slice(start, start + viewport)};
}
