import type {HardwareAnalysis} from '@/application/use-cases';
import type {JunkReport} from '@/domain/junk';
import type {ResidueReport} from '@/domain/residue';
import {safeFindings} from '@/domain/residue';
import type {StartupInventory} from '@/domain/startup';
import {statusOf} from '@/domain/startup';
import {translate, type Translator} from '@/i18n/translator';
import {formatBytes, formatCount, pad, padStart} from '@/shared/format';

/** Plain-text renderers for the non-interactive modes. Pure string building. */

const MARK: Readonly<Record<string, string>> = Object.freeze({
	running: '+',
	stopped: 'o',
	disabled: 'x',
	missing: '!',
});

function terminalWidth(): number {
	return Math.max(60, (process.stdout.columns ?? 100) - 1);
}

export function renderStartup(inventory: StartupInventory, t: Translator): string {
	const width = terminalWidth();
	const nameWidth = Math.min(32, Math.max(16, width - 60));
	const lines: string[] = [];

	lines.push(
		`  ${pad(t('startup.columns.name'), nameWidth)}${pad(t('startup.columns.source'), 26)}` +
			`${pad(t('startup.columns.status'), 12)}${pad(t('startup.columns.memory'), 9)}${t('startup.columns.publisher')}`,
	);

	for (const entry of inventory.entries) {
		const status = statusOf(entry);
		lines.push(
			`${MARK[status] ?? '?'} ${pad(entry.name, nameWidth)}${pad(t(`startup.source.${entry.source}`), 26)}` +
				`${pad(t(`startup.status.${status}`), 12)}${pad(entry.running ? formatBytes(entry.memoryBytes) : '-', 9)}` +
				`${entry.publisher ?? '-'}`,
		);
	}

	const running = inventory.entries.filter(entry => entry.running && entry.enabled).length;
	const disabled = inventory.entries.filter(entry => !entry.enabled).length;
	const missing = inventory.entries.filter(entry => !entry.executableExists).length;

	lines.push('');
	lines.push(
		`  ${t('startup.summary', {total: inventory.entries.length})} - ${t('startup.running', {count: running})}` +
			` - ${t('startup.disabled', {count: disabled})} - ${t('startup.missing', {count: missing})}`,
	);

	return lines.join('\n');
}

export function renderResidue(report: ResidueReport, t: Translator): string {
	const width = terminalWidth();
	const titleWidth = Math.min(36, Math.max(18, width - 64));
	const lines: string[] = [];

	let currentClass = '';
	for (const finding of report.findings) {
		if (finding.residueClass !== currentClass) {
			currentClass = finding.residueClass;
			lines.push('');
			lines.push(`  ${t(`residue.classes.${currentClass}`).toUpperCase()}`);
		}
		const mark = finding.risk === 'safe' ? '-' : '?';
		const size = finding.sizeBytes > 0 ? ` (${formatBytes(finding.sizeBytes)})` : '';
		lines.push(`  ${mark} ${pad(finding.title, titleWidth)} ${finding.evidence ?? ''}${size}`);
	}

	const safe = safeFindings(report.findings);
	const reclaimable = report.findings.reduce((total, finding) => total + finding.sizeBytes, 0);

	lines.push('');
	lines.push(
		`  ${t('residue.summary', {total: report.findings.length})} - ${t('cli.safeCount', {count: safe.length})}` +
			` - ${t('cli.reviewCount', {count: report.findings.length - safe.length})}` +
			(reclaimable > 0 ? ` - ${formatBytes(reclaimable)}` : ''),
	);

	return lines.join('\n');
}

export function renderJunk(report: JunkReport, t: Translator): string {
	const width = terminalWidth();
	const nameWidth = Math.min(30, Math.max(18, width - 66));
	const lines: string[] = [];

	lines.push(
		`  ${pad(t('junk.columns.location'), nameWidth)}${pad(t('junk.columns.category'), 26)}` +
			`${padStart(t('junk.columns.files'), 10)}${padStart(t('junk.columns.size'), 12)}`,
	);

	const sorted = [...report.findings].sort((a, b) => b.sizeBytes - a.sizeBytes);
	for (const finding of sorted) {
		const mark = finding.target.risk === 'safe' ? '-' : '?';
		lines.push(
			`${mark} ${pad(finding.target.id, nameWidth)}${pad(t(`junk.categories.${finding.target.category}`), 26)}` +
				`${padStart(formatCount(finding.fileCount), 10)}${padStart(formatBytes(finding.sizeBytes), 12)}`,
		);
	}

	const total = report.findings.reduce((sum, finding) => sum + finding.sizeBytes, 0);
	const safe = report.findings.filter(finding => finding.target.risk === 'safe');
	const safeTotal = safe.reduce((sum, finding) => sum + finding.sizeBytes, 0);

	lines.push('');
	lines.push(
		`  ${t('junk.summary', {total: report.findings.length})} - ${t('junk.reclaimable', {size: formatBytes(total)})}` +
			` - ${t('cli.safeCount', {count: safe.length})} (${formatBytes(safeTotal)})`,
	);

	return lines.join('\n');
}

export function renderHardware(analysis: HardwareAnalysis, t: Translator): string {
	const {report, recommendations} = analysis;
	const lines: string[] = [];

	lines.push(`  ${t('hardware.system').toUpperCase()}`);
	lines.push(`  ${pad(t('hardware.cpu'), 16)}${report.capabilities.cpuBrand}`);
	lines.push(
		`  ${pad(t('hardware.memory'), 16)}${formatBytes(report.capabilities.memoryTotalBytes)}` +
			` (${formatBytes(report.capabilities.memoryFreeBytes)} ${t('hardware.free')})`,
	);
	lines.push(
		`  ${pad(t('hardware.secureBoot'), 16)}${
			report.capabilities.secureBoot === null
				? t('hardware.unknown')
				: report.capabilities.secureBoot
					? t('hardware.enabled')
					: t('hardware.disabled')
		}`,
	);
	lines.push(
		`  ${pad(t('hardware.virtualization'), 16)}${
			report.capabilities.virtualizationEnabled === null
				? t('hardware.unknown')
				: report.capabilities.virtualizationEnabled
					? t('hardware.enabled')
					: t('hardware.disabled')
		}`,
	);
	lines.push(
		`  ${pad(t('hardware.powerPlan'), 16)}${report.capabilities.powerPlan ?? t('hardware.unknown')}`,
	);

	lines.push('');
	lines.push(`  ${t('hardware.graphics').toUpperCase()}`);
	for (const controller of report.graphics.controllers) {
		const kind = controller.integrated ? t('hardware.integrated') : t('hardware.discrete');
		const vram = controller.vramBytes ? `${formatBytes(controller.vramBytes)} ${t('hardware.vram')}` : '-';
		lines.push(
			`  ${pad(`${controller.vendor} ${controller.model}`, 44)}${pad(kind, 12)}${pad(vram, 16)}` +
				`${t('hardware.driver')} ${controller.driverVersion ?? '-'}`,
		);
	}

	lines.push('');
	lines.push(`  ${t('hardware.displays').toUpperCase()}`);
	for (const display of report.graphics.displays) {
		const name = [display.vendor, display.model].filter(Boolean).join(' ') || '-';
		lines.push(
			`  ${pad(name, 30)}${display.currentWidth ?? '?'}x${display.currentHeight ?? '?'}` +
				` @ ${display.currentRefreshHz ?? '?'} Hz` +
				` (${t('hardware.native')} ${display.nativeWidth ?? '?'}x${display.nativeHeight ?? '?'},` +
				` ${display.pixelDepth ?? '?'}-bit)`,
		);
	}

	lines.push('');
	lines.push(`  ${t('hardware.wsl').toUpperCase()}`);
	if (!analysis.wsl) {
		lines.push(`  ${t('hardware.wslNotInstalled')}`);
	} else {
		const {wsl} = analysis;
		lines.push(
			`  ${pad(t('hardware.wslDistributions'), 16)}${
				wsl.distributions
					.map(
						d => `${d.name} (v${d.version}, ${d.state}${d.isDefault ? `, ${t('hardware.wslDefault')}` : ''})`,
					)
					.join(', ') || '-'
			}`,
		);
		const gib = (value: number | null): string =>
			value === null ? t('hardware.notSet') : formatBytes(value);
		lines.push(
			`  ${pad(t('hardware.wslConfig'), 16)}memory=${gib(wsl.config.memoryBytes)}` +
				`  processors=${wsl.config.processors ?? t('hardware.notSet')}` +
				`  swap=${gib(wsl.config.swapBytes)}` +
				`  gpu=${wsl.config.gpuSupport === null ? t('hardware.notSet') : String(wsl.config.gpuSupport)}`,
		);
		lines.push(`  ${pad('', 16)}${wsl.config.exists ? wsl.config.path : t('hardware.notSet')}`);
	}

	lines.push('');
	lines.push(`  ${t('hardware.recommendations').toUpperCase()}`);
	if (recommendations.length === 0) {
		lines.push(`  ${t('hardware.noRecommendations')}`);
	}
	for (const item of recommendations) {
		lines.push('');
		lines.push(`  [${t(`hardware.impact.${item.impact}`)}] ${translate(t, item.title)}`);
		lines.push(`    ${t('hardware.detail.finding')}: ${translate(t, item.finding)}`);
		lines.push(`    ${t('hardware.detail.advice')}: ${translate(t, item.advice)}`);
		if (item.action) {
			lines.push(`    ${t('hardware.detail.where')}: ${translate(t, item.action.location)}`);
			if (item.action.command) {
				lines.push(`    ${t('hardware.detail.command')}: ${item.action.command}`);
			}
		}
	}

	return lines.join('\n');
}
