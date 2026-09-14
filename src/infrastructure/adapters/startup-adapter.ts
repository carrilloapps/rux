import {z} from 'zod';
import {bytes} from '@/domain/common';
import type {ProcessInfo, RawStartupEntry} from '@/domain/startup';
import {STARTUP_SOURCES} from '@/domain/startup';
import type {StartupInventoryPort, StartupMutation, StartupMutationPort} from '@/application/ports';
import {RuxError} from '@/shared/errors';
import type {PowerShellRunner} from '@/infrastructure/powershell/runner';
import {psArray, psCount, psNumber, psString, psText} from '@/infrastructure/powershell/schema';
import {
	MUTATE_STARTUP_SCRIPT,
	SCAN_PROCESSES_SCRIPT,
	SCAN_STARTUP_SCRIPT,
} from '@/infrastructure/powershell/scripts/startup';

const nullableString = psString;
const nullableNumber = psNumber;

const processSchema = z.object({
	pid: z.number(),
	name: z.string(),
	executablePath: nullableString,
	memoryBytes: psCount(0),
});

const entrySchema = z.object({
	id: z.string(),
	name: z.string(),
	command: psText(''),
	executablePath: nullableString,
	executableName: nullableString,
	source: z.enum(STARTUP_SOURCES),
	kind: z.enum(['registry', 'folder', 'task']),
	elevation: z.enum(['user', 'administrator']),
	enabled: z.boolean(),
	location: z.string(),
	approvalKey: nullableString,
	approvalHive: z
		.union([z.literal('HKCU'), z.literal('HKLM'), z.null()])
		.optional()
		.transform(v => v ?? null),
	taskPath: nullableString,
	executableExists: z.boolean(),
	publisher: nullableString,
	fileSizeBytes: nullableNumber,
	modifiedAt: nullableString,
});

const inventorySchema = z.object({
	entries: psArray(entrySchema),
	processes: psArray(processSchema),
	elevated: z.boolean(),
	userName: z.string(),
	machineName: z.string(),
});

const processesSchema = z.object({processes: psArray(processSchema)});

const mutationSchema = z.object({ok: z.boolean(), message: z.string()});

function toProcess(raw: z.infer<typeof processSchema>): ProcessInfo {
	return {
		pid: raw.pid,
		name: raw.name,
		executablePath: raw.executablePath,
		memoryBytes: bytes(raw.memoryBytes),
	};
}

function toEntry(raw: z.infer<typeof entrySchema>): RawStartupEntry {
	return {
		id: raw.id,
		name: raw.name,
		command: raw.command,
		executablePath: raw.executablePath,
		executableName: raw.executableName,
		source: raw.source,
		kind: raw.kind,
		elevation: raw.elevation,
		enabled: raw.enabled,
		location: raw.location,
		approvalKey: raw.approvalKey,
		approvalHive: raw.approvalHive,
		taskPath: raw.taskPath,
		executableExists: raw.executableExists,
		publisher: raw.publisher,
		fileSizeBytes: raw.fileSizeBytes === null ? null : bytes(raw.fileSizeBytes),
		modifiedAt: raw.modifiedAt,
	};
}

export function createStartupInventoryAdapter(runner: PowerShellRunner): StartupInventoryPort {
	return {
		async readStartupEntries(includeTasks: boolean) {
			const payload = await runner.json(SCAN_STARTUP_SCRIPT, inventorySchema, {includeTasks});
			return {
				entries: payload.entries.map(toEntry),
				processes: payload.processes.map(toProcess),
				elevated: payload.elevated,
				machineName: payload.machineName,
				userName: payload.userName,
			};
		},

		async readProcesses() {
			const payload = await runner.json(SCAN_PROCESSES_SCRIPT, processesSchema);
			return payload.processes.map(toProcess);
		},
	};
}

export function createStartupMutationAdapter(runner: PowerShellRunner): StartupMutationPort {
	return {
		async mutate(entry: RawStartupEntry, mutation: StartupMutation): Promise<void> {
			const result = await runner.json(MUTATE_STARTUP_SCRIPT, mutationSchema, {entry, mutation});
			if (!result.ok) throw new RuxError(result.message);
		},
	};
}
