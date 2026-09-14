import {describe, expect, it} from 'vitest';
import {z} from 'zod';
import {createPowerShellRunner, emitResult} from '@/infrastructure/powershell/runner';
import {RuxError} from '@/shared/errors';

/**
 * These run real PowerShell.
 *
 * The transport is the piece most likely to break on a specific machine, and
 * mocking `child_process` would test the mock rather than the behaviour that
 * matters: encoding, parameter passing and error surfacing. The suite already
 * only runs on Windows, so PowerShell is available.
 */

const runner = createPowerShellRunner();

describe('PowerShell runner', () => {
	it('runs a script and validates its JSON output', async () => {
		const schema = z.object({value: z.number()});
		const result = await runner.json(emitResult('[pscustomobject]@{ value = 42 }'), schema);
		expect(result.value).toBe(42);
	});

	it('passes parameters without interpolating them into the script', async () => {
		const schema = z.object({echoed: z.string()});
		// A path with a quote, an ampersand and a backslash would break any
		// script that pasted it into source.
		const hostile = 'C:\\Program Files\\A"B & C\\app.exe';

		const result = await runner.json(emitResult('[pscustomobject]@{ echoed = $RuxInput.path }'), schema, {
			path: hostile,
		});

		expect(result.echoed).toBe(hostile);
	});

	it('carries non-ASCII text through unharmed in both directions', async () => {
		const schema = z.object({echoed: z.string()});
		const text = 'Configuracion grafica anadida - 100% senal';

		const result = await runner.json(emitResult('[pscustomobject]@{ echoed = $RuxInput.text }'), schema, {
			text,
		});

		expect(result.echoed).toBe(text);
	});

	it('handles a script far larger than a Windows command line allows', async () => {
		// Windows caps a command line at 32767 characters, which is why scripts
		// travel as files rather than as an encoded command.
		const filler = Array.from({length: 1200}, (_value, index) => `# padding line ${index}`).join('\n');
		const schema = z.object({ok: z.boolean()});

		const result = await runner.json(`${filler}\n${emitResult('[pscustomobject]@{ ok = $true }')}`, schema);

		expect(result.ok).toBe(true);
	});

	it('reports a script that produces no output', async () => {
		await expect(runner.json('$null', z.object({}))).rejects.toThrow(/no output/i);
	});

	it('reports output that is not JSON', async () => {
		await expect(runner.json('Write-Output "not json"', z.object({}))).rejects.toThrow(/not valid JSON/i);
	});

	it('reports a payload that does not match the schema', async () => {
		const schema = z.object({value: z.number()});

		await expect(runner.json(emitResult('[pscustomobject]@{ value = "text" }'), schema)).rejects.toThrow(
			/unexpected PowerShell payload/i,
		);
	});

	it('surfaces a thrown PowerShell error', async () => {
		await expect(runner.json('throw "deliberate failure"', z.object({}))).rejects.toBeInstanceOf(RuxError);
	});

	it('prefers a JSON error payload over the raw failure', async () => {
		const schema = z.object({ok: z.boolean(), message: z.string()});
		const script = [emitResult('[pscustomobject]@{ ok = $false; message = "handled" }'), 'exit 1'].join('\n');

		const result = await runner.json(script, schema);

		expect(result).toEqual({ok: false, message: 'handled'});
	});
});

describe('emitResult', () => {
	it('writes to stdout when no output file is set', () => {
		expect(emitResult('$x')).toContain('$RuxPayload');
		expect(emitResult('$x')).toContain('if ($RuxOutFile)');
	});
});
