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

/** Raised when an operation needs administrator rights that the process lacks. */
export class ElevationRequiredError extends RuxError {
	constructor(operation: string) {
		super(`"${operation}" requires administrator rights`);
		this.name = 'ElevationRequiredError';
	}
}

/** Raised when rux is started somewhere it cannot work. */
export class UnsupportedPlatformError extends RuxError {
	constructor(platform: string) {
		super(`rux supports Windows only; detected "${platform}"`);
		this.name = 'UnsupportedPlatformError';
	}
}

export function describeError(error: unknown): string {
	if (error instanceof RuxError) return error.toString();
	if (error instanceof Error) return error.message;
	return String(error);
}
