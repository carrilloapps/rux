/** Base error for every failure rux raises deliberately. */
export class RuxError extends Error {
	readonly detail: string | undefined;

	constructor(message: string, detail?: string) {
		super(message);
		this.name = 'RuxError';
		this.detail = detail;
	}

	override toString(): string {
		return this.detail ? `${this.message}: ${this.detail}` : this.message;
	}
}

export function describeError(error: unknown): string {
	if (error instanceof RuxError) return error.toString();
	if (error instanceof Error) return error.message;
	return String(error);
}
