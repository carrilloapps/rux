import type {Ports} from '@/application/ports';
import type {UseCases} from '@/application/use-cases';
import {createUseCases} from '@/application/use-cases';
import {createHardwareAdapter} from '@/infrastructure/adapters/hardware-adapter';
import {createJunkCleanAdapter, createJunkScanAdapter} from '@/infrastructure/adapters/junk-adapter';
import {
	createBackupAdapter,
	createResidueRemovalAdapter,
	createResidueScanAdapter,
} from '@/infrastructure/adapters/residue-adapter';
import {
	createStartupInventoryAdapter,
	createStartupMutationAdapter,
} from '@/infrastructure/adapters/startup-adapter';
import {createWslAdapter} from '@/infrastructure/adapters/wsl-adapter';
import {createPowerShellRunner} from '@/infrastructure/powershell/runner';

/**
 * Composition root: the single place where concrete adapters are chosen.
 *
 * Everything above this file depends on interfaces only, so swapping the
 * PowerShell transport or stubbing a port in tests touches nothing else.
 */
export function createPorts(): Ports {
	const runner = createPowerShellRunner();

	return {
		startupInventory: createStartupInventoryAdapter(runner),
		startupMutation: createStartupMutationAdapter(runner),
		residueScan: createResidueScanAdapter(runner),
		residueRemoval: createResidueRemovalAdapter(runner),
		junkScan: createJunkScanAdapter(runner),
		junkClean: createJunkCleanAdapter(runner),
		hardware: createHardwareAdapter(runner),
		wsl: createWslAdapter(runner),
		backup: createBackupAdapter(runner),
	};
}

export function createApplication(): UseCases {
	return createUseCases(createPorts());
}
