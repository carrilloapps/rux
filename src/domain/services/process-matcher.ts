import path from 'node:path';
import {bytes} from '@/domain/common';
import type {MatchReason, ProcessInfo, RawStartupEntry, StartupEntry} from '@/domain/startup';

/**
 * Shared system directories hold hundreds of unrelated binaries, so an entry that
 * lives in one of them must never claim every process underneath it.
 */
const BROAD_DIRECTORIES: readonly string[] = [
	'c:\\windows',
	'c:\\windows\\system32',
	'c:\\windows\\syswow64',
	'c:\\program files',
	'c:\\program files (x86)',
];

const EXE_IN_COMMAND = /([\w.-]+\.exe)/gi;

/** Every `.exe` named anywhere in a command line, e.g. Squirrel's `--processStart App.exe`. */
export function executableNamesInCommand(command: string): readonly string[] {
	return [...new Set(Array.from(command.matchAll(EXE_IN_COMMAND), match => match[1]!.toLowerCase()))];
}

interface ProcessIndex {
	readonly byPath: ReadonlyMap<string, ProcessInfo[]>;
	readonly byName: ReadonlyMap<string, ProcessInfo[]>;
	readonly all: readonly ProcessInfo[];
}

function indexProcesses(processes: readonly ProcessInfo[]): ProcessIndex {
	const byPath = new Map<string, ProcessInfo[]>();
	const byName = new Map<string, ProcessInfo[]>();

	for (const process of processes) {
		if (process.executablePath) {
			const key = process.executablePath.toLowerCase();
			byPath.set(key, [...(byPath.get(key) ?? []), process]);
		}
		const nameKey = `${process.name.toLowerCase()}.exe`;
		byName.set(nameKey, [...(byName.get(nameKey) ?? []), process]);
	}

	return {byPath, byName, all: processes};
}

function matchOne(
	entry: RawStartupEntry,
	index: ProcessIndex,
): {matches: ProcessInfo[]; reason: MatchReason | null} {
	// 1. The process runs the exact registered executable.
	if (entry.executablePath) {
		const exact = index.byPath.get(entry.executablePath.toLowerCase());
		if (exact?.length) return {matches: exact, reason: 'path'};
	}

	// 2. A launcher stub names its real target on the command line.
	for (const name of executableNamesInCommand(entry.command)) {
		if (name === entry.executableName?.toLowerCase()) continue;
		const found = index.byName.get(name);
		if (found?.length) return {matches: found, reason: 'command'};
	}

	// 3. Same filename in a different folder, as versioned installers produce.
	if (entry.executableName) {
		const named = index.byName.get(entry.executableName.toLowerCase());
		if (named?.length) return {matches: named, reason: 'name'};
	}

	// 4. Last resort: a process running from the entry's own install folder.
	if (entry.executablePath) {
		const directory = path.dirname(entry.executablePath).toLowerCase();
		if (directory.length > 3 && !BROAD_DIRECTORIES.includes(directory)) {
			const prefix = `${directory}\\`;
			const inFolder = index.all.filter(process => process.executablePath?.toLowerCase().startsWith(prefix));
			if (inFolder.length) return {matches: inFolder, reason: 'directory'};
		}
	}

	return {matches: [], reason: null};
}

/**
 * Correlates startup entries with live processes.
 *
 * Exact path comparison is authoritative; the looser rules exist because real
 * startup entries are frequently launcher stubs rather than the program itself.
 */
export function correlateProcesses(
	entries: readonly RawStartupEntry[],
	processes: readonly ProcessInfo[],
): readonly StartupEntry[] {
	const index = indexProcesses(processes);

	return entries.map(entry => {
		const {matches, reason} = matchOne(entry, index);
		return {
			...entry,
			running: matches.length > 0,
			pids: matches.map(match => match.pid),
			memoryBytes: bytes(matches.reduce((total, match) => total + match.memoryBytes, 0)),
			matchReason: reason,
		};
	});
}
