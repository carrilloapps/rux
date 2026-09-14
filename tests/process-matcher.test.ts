import {describe, expect, it} from 'vitest';
import {bytes} from '@/domain/common';
import {correlateProcesses, executableNamesInCommand} from '@/domain/services/process-matcher';
import type {ProcessInfo, RawStartupEntry} from '@/domain/startup';

function entry(overrides: Partial<RawStartupEntry>): RawStartupEntry {
	return {
		id: 'test',
		name: 'Test',
		command: '',
		executablePath: null,
		executableName: null,
		source: 'run-user',
		kind: 'registry',
		elevation: 'user',
		enabled: true,
		location: 'HKCU:\\Run',
		approvalKey: 'Run',
		approvalHive: 'HKCU',
		taskPath: null,
		executableExists: true,
		publisher: null,
		fileSizeBytes: null,
		modifiedAt: null,
		...overrides,
	};
}

function process(pid: number, name: string, executablePath: string | null): ProcessInfo {
	return {pid, name, executablePath, memoryBytes: bytes(1024)};
}

describe('executableNamesInCommand', () => {
	it('extracts every executable named on the command line', () => {
		const names = executableNamesInCommand('"C:\\App\\Update.exe" --processStart Discord.exe --other');
		expect(names).toContain('update.exe');
		expect(names).toContain('discord.exe');
	});

	it('deduplicates repeated names', () => {
		expect(executableNamesInCommand('a.exe a.exe')).toEqual(['a.exe']);
	});
});

describe('correlateProcesses', () => {
	it('matches on the exact registered path', () => {
		const [result] = correlateProcesses(
			[entry({executablePath: 'C:\\App\\app.exe', executableName: 'app.exe', command: 'C:\\App\\app.exe'})],
			[process(1, 'app', 'C:\\App\\app.exe')],
		);
		expect(result?.running).toBe(true);
		expect(result?.matchReason).toBe('path');
	});

	it('matches a launcher stub through its command line target', () => {
		const [result] = correlateProcesses(
			[
				entry({
					command: '"C:\\U\\Discord\\Update.exe" --processStart Discord.exe',
					executablePath: 'C:\\U\\Discord\\Update.exe',
					executableName: 'Update.exe',
				}),
			],
			[process(1, 'Discord', 'C:\\U\\Discord\\app-1.0.9\\Discord.exe')],
		);
		expect(result?.running).toBe(true);
		expect(result?.matchReason).toBe('command');
	});

	it('matches a versioned install folder by executable name', () => {
		const [result] = correlateProcesses(
			[
				entry({
					command: '"C:\\U\\slack\\slack.exe" --startup',
					executablePath: 'C:\\U\\slack\\slack.exe',
					executableName: 'slack.exe',
				}),
			],
			[process(2, 'slack', 'C:\\U\\slack\\app-4.52\\slack.exe')],
		);
		expect(result?.running).toBe(true);
		expect(result?.matchReason).toBe('name');
	});

	it('never lets a System32 entry claim unrelated processes', () => {
		const [result] = correlateProcesses(
			[
				entry({
					command: 'C:\\Windows\\System32\\SecurityHealthSystray.exe',
					executablePath: 'C:\\Windows\\System32\\SecurityHealthSystray.exe',
					executableName: 'SecurityHealthSystray.exe',
				}),
			],
			[process(4, 'svchost', 'C:\\Windows\\System32\\svchost.exe')],
		);
		expect(result?.running).toBe(false);
		expect(result?.matchReason).toBeNull();
	});

	it('falls back to the entry install folder for a renamed binary', () => {
		const [result] = correlateProcesses(
			[
				entry({
					command: 'C:\\Vendor\\Tool\\launcher.exe',
					executablePath: 'C:\\Vendor\\Tool\\launcher.exe',
					executableName: 'launcher.exe',
				}),
			],
			[process(9, 'worker', 'C:\\Vendor\\Tool\\bin\\worker.exe')],
		);
		expect(result?.running).toBe(true);
		expect(result?.matchReason).toBe('directory');
	});

	it('reports a stopped entry when nothing matches', () => {
		const [result] = correlateProcesses(
			[
				entry({
					executablePath: 'C:\\Gone\\gone.exe',
					executableName: 'gone.exe',
					command: 'C:\\Gone\\gone.exe',
				}),
			],
			[process(1, 'other', 'C:\\Other\\other.exe')],
		);
		expect(result?.running).toBe(false);
		expect(result?.pids).toEqual([]);
	});

	it('sums memory across every matching process', () => {
		const [result] = correlateProcesses(
			[entry({executablePath: 'C:\\A\\a.exe', executableName: 'a.exe', command: 'C:\\A\\a.exe'})],
			[process(1, 'a', 'C:\\A\\a.exe'), process(2, 'a', 'C:\\A\\a.exe')],
		);
		expect(result?.pids).toEqual([1, 2]);
		expect(result?.memoryBytes).toBe(2048);
	});
});
