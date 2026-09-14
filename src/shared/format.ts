/** Terminal formatting helpers, free of any domain knowledge. */

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const;

export function formatBytes(value: number | null | undefined): string {
	if (!value || value <= 0) return '-';
	let size = value;
	let unit = 0;
	while (size >= 1024 && unit < UNITS.length - 1) {
		size /= 1024;
		unit += 1;
	}
	const rounded = size < 10 && unit > 0 ? size.toFixed(1) : Math.round(size).toString();
	return `${rounded} ${UNITS[unit]}`;
}

export function formatCount(value: number): string {
	return new Intl.NumberFormat('en-US').format(value);
}

export function truncate(value: string, width: number): string {
	if (width <= 0) return '';
	if (value.length <= width) return value;
	if (width <= 1) return value.slice(0, width);
	// A single trailing period reads as truncation without needing a wide glyph.
	return `${value.slice(0, width - 1)}~`;
}

export function pad(value: string, width: number): string {
	return truncate(value, width).padEnd(width);
}

export function padStart(value: string, width: number): string {
	return truncate(value, width).padStart(width);
}

export function formatDate(iso: string | null | undefined): string {
	if (!iso) return '-';
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '-';
	return date.toISOString().slice(0, 10);
}

export function formatDateTime(iso: string | null | undefined): string {
	if (!iso) return '-';
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '-';
	return date.toISOString().slice(0, 19).replace('T', ' ');
}
