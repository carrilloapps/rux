/* eslint-disable @typescript-eslint/no-unsafe-return --
 * These functions are generic over a Zod schema and return that schema's own
 * output type. While the generic is unresolved, `z.output<S>` is `any` to the
 * linter, so every return reads as unsafe even though each call site receives a
 * fully typed value. The parse itself is validated against the schema, which is
 * the real safety boundary. Narrowing the generic further would push `unknown`
 * onto every caller for no gain.
 */
import {execFile} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {promisify} from 'node:util';
import type {SafeParseReturnType, ZodTypeAny, output as ZodOutput} from 'zod';
import {RuxError} from '@/shared/errors';

const execFileAsync = promisify(execFile);

/**
 * Windows PowerShell 5.1 ships with every supported Windows release, so rux
 * never requires the user to install PowerShell 7.
 */
const POWERSHELL = 'powershell.exe';

const DEFAULT_MAX_BUFFER = 64 * 1024 * 1024;

/**
 * Windows PowerShell reads a script file as ANSI unless it starts with a byte
 * order mark, at which point it honours the declared encoding. Writing the BOM
 * is what keeps non-ASCII characters inside script literals from silently
 * corrupting the parse.
 *
 * A temp file is used rather than -EncodedCommand because an encoded command is
 * still a command line, and Windows caps those at 32767 characters. Base64 of
 * UTF-16 inflates a script by roughly 2.7x, so larger scans overflow the limit.
 */
const UTF8_BOM = '﻿';

/**
 * Parameters travel as base64-encoded JSON bound to `$RuxInput`, so no caller
 * value is ever interpolated into script text. Paths containing quotes,
 * ampersands or newlines cannot break the script or inject commands.
 */
function withParameters(script: string, parameters: unknown): string {
	if (parameters === undefined) return script;
	const encoded = Buffer.from(JSON.stringify(parameters), 'utf8').toString('base64');
	return [
		`$RuxInput = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')) | ConvertFrom-Json`,
		script,
	].join('\n');
}

const PREAMBLE = [
	'$ErrorActionPreference = "Stop"',
	'$ProgressPreference = "SilentlyContinue"',
	'$WarningPreference = "SilentlyContinue"',
	// Force UTF-8 on the way out so accented output survives the pipe.
	'[Console]::OutputEncoding = [Text.Encoding]::UTF8',
].join('\n');

function buildScript(script: string, parameters: unknown, outFile?: string): string {
	const head = outFile ? `$RuxOutFile = '${outFile.replace(/'/g, "''")}'` : '$RuxOutFile = $null';
	return [UTF8_BOM + PREAMBLE, head, withParameters(script, parameters)].join('\n');
}

function parseOutput<S extends ZodTypeAny>(stdout: string, schema: S, context: string): ZodOutput<S> {
	const trimmed = stdout.trim();
	if (trimmed.length === 0) {
		throw new RuxError(`${context}: PowerShell produced no output`);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(trimmed);
	} catch {
		throw new RuxError(`${context}: PowerShell output was not valid JSON`, trimmed.slice(0, 500));
	}

	// safeParse on a generic schema widens `data` to `any`; restating the return
	// type here keeps the value typed for every caller.
	const result = schema.safeParse(parsed) as SafeParseReturnType<unknown, ZodOutput<S>>;
	if (!result.success) {
		const issues = result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ');
		throw new RuxError(`${context}: unexpected PowerShell payload`, issues);
	}
	return result.data;
}

export interface PowerShellRunner {
	/** Runs a script and validates its JSON output against a schema. */
	json<S extends ZodTypeAny>(script: string, schema: S, parameters?: unknown): Promise<ZodOutput<S>>;
	/** Runs a script through UAC; output travels back through a temp file. */
	elevatedJson<S extends ZodTypeAny>(script: string, schema: S, parameters?: unknown): Promise<ZodOutput<S>>;
}

interface Workspace {
	readonly directory: string;
	readonly scriptFile: string;
	readonly outFile: string;
	dispose(): Promise<void>;
}

async function createWorkspace(): Promise<Workspace> {
	const directory = await mkdtemp(path.join(tmpdir(), 'rux-'));
	const token = randomUUID();
	return {
		directory,
		scriptFile: path.join(directory, `${token}.ps1`),
		outFile: path.join(directory, `${token}.json`),
		dispose: () => rm(directory, {recursive: true, force: true}),
	};
}

export function createPowerShellRunner(): PowerShellRunner {
	return {
		async json<S extends ZodTypeAny>(script: string, schema: S, parameters?: unknown): Promise<ZodOutput<S>> {
			const workspace = await createWorkspace();
			try {
				await writeFile(workspace.scriptFile, buildScript(script, parameters), 'utf8');
				const {stdout} = await execFileAsync(
					POWERSHELL,
					['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', workspace.scriptFile],
					{maxBuffer: DEFAULT_MAX_BUFFER, windowsHide: true},
				);
				return parseOutput(stdout, schema, 'powershell');
			} catch (error) {
				const failure = error as {stdout?: string; stderr?: string; message?: string};
				// Scripts report handled failures as JSON before exiting non-zero.
				if (failure.stdout?.trim()) {
					return parseOutput(failure.stdout, schema, 'powershell');
				}
				throw new RuxError(
					'PowerShell call failed',
					failure.stderr?.trim() ?? failure.message ?? 'unknown error',
				);
			} finally {
				await workspace.dispose();
			}
		},

		async elevatedJson<S extends ZodTypeAny>(
			script: string,
			schema: S,
			parameters?: unknown,
		): Promise<ZodOutput<S>> {
			const workspace = await createWorkspace();
			try {
				// The elevated process owns a separate console, so the payload is
				// written to a file that the unelevated parent reads back afterwards.
				await writeFile(workspace.scriptFile, buildScript(script, parameters, workspace.outFile), 'utf8');

				const launcher = [
					`$arguments = @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File','${workspace.scriptFile.replace(/'/g, "''")}')`,
					`$process = Start-Process -FilePath '${POWERSHELL}' -Verb RunAs -Wait -PassThru -WindowStyle Hidden -ArgumentList $arguments`,
					'exit $process.ExitCode',
				].join('\n');
				const launcherFile = path.join(workspace.directory, 'launch.ps1');
				await writeFile(launcherFile, UTF8_BOM + launcher, 'utf8');

				await execFileAsync(POWERSHELL, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', launcherFile], {
					maxBuffer: DEFAULT_MAX_BUFFER,
					windowsHide: true,
				});

				const written = await readFile(workspace.outFile, 'utf8');
				return parseOutput(written, schema, 'elevated powershell');
			} catch (error) {
				const failure = error as {message?: string};
				throw new RuxError(
					'Elevated PowerShell call failed',
					failure.message ?? 'The administrator prompt may have been declined.',
				);
			} finally {
				await workspace.dispose();
			}
		},
	};
}

/**
 * Emits the tail every script needs: write to `$RuxOutFile` when running
 * elevated, otherwise to stdout.
 */
export function emitResult(expression: string): string {
	return [
		`$RuxPayload = ${expression} | ConvertTo-Json -Depth 8 -Compress`,
		'if ($RuxOutFile) { Set-Content -LiteralPath $RuxOutFile -Value $RuxPayload -Encoding UTF8 } else { $RuxPayload }',
	].join('\n');
}
