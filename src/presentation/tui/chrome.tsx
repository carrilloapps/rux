import {Box, Text} from 'ink';
import type {HardwareAnalysis} from '@/application/use-cases';
import type {JunkFinding, JunkReport} from '@/domain/junk';
import type {ResidueReport} from '@/domain/residue';
import type {StartupInventory} from '@/domain/startup';
import {LOCALE_LABELS, type Locale, type Translator} from '@/i18n/translator';
import {formatBytes} from '@/shared/format';
import {VIEWS, VIEW_LABEL_KEY, type View} from '@/presentation/tui/view';

export interface HeaderProps {
	readonly view: View;
	readonly locale: Locale;
	readonly elevated: boolean;
	readonly readOnly: boolean;
	readonly machineName: string;
	readonly t: Translator;
}

export function Header({view, locale, elevated, readOnly, machineName, t}: HeaderProps) {
	return (
		<Box paddingX={1} justifyContent="space-between">
			<Text>
				<Text color="cyan" bold>
					{t('app.name')}
				</Text>
				<Text dimColor> </Text>
				{VIEWS.map((candidate, index) => (
					<Text key={candidate}>
						{index > 0 ? <Text dimColor> | </Text> : null}
						<Text color={view === candidate ? 'cyan' : undefined} bold={view === candidate}>
							{t(VIEW_LABEL_KEY[candidate])}
						</Text>
					</Text>
				))}
				{elevated ? (
					<Text color="green"> [{t('app.elevatedBadge')}]</Text>
				) : (
					<Text dimColor> [{t('app.userBadge')}]</Text>
				)}
				{readOnly ? <Text color="yellow"> [{t('app.readOnlyBadge')}]</Text> : null}
			</Text>
			<Text dimColor>
				{LOCALE_LABELS[locale]} {machineName}
			</Text>
		</Box>
	);
}

export interface SummaryProps {
	readonly view: View;
	readonly inventory: StartupInventory | null;
	readonly residue: ResidueReport | null;
	readonly junkFindings: readonly JunkFinding[];
	readonly junkSelected: readonly JunkFinding[];
	readonly junk: JunkReport | null;
	readonly hardware: HardwareAnalysis | null;
	readonly residueSelectedCount: number;
	readonly filter: string;
	readonly sort: string;
	readonly includeTasks: boolean;
	readonly deep: boolean;
	readonly busy: boolean;
	readonly t: Translator;
}

/** The one-line count strip under the header, per view. */
export function Summary(props: SummaryProps) {
	const {view, t, busy} = props;

	return (
		<Box paddingX={1}>
			<Text>
				{view === 'startup' ? <StartupSummary {...props} /> : null}
				{view === 'residue' ? <ResidueSummary {...props} /> : null}
				{view === 'junk' ? <JunkSummary {...props} /> : null}
				{view === 'hardware' ? <HardwareSummary {...props} /> : null}
				{busy ? <Text dimColor> - {t('app.refreshing')}</Text> : null}
			</Text>
		</Box>
	);
}

function StartupSummary({inventory, filter, sort, includeTasks, t}: SummaryProps) {
	if (!inventory) return null;
	const entries = inventory.entries;
	return (
		<Text>
			<Text bold>{t('startup.summary', {total: entries.length})}</Text>
			<Text dimColor> - </Text>
			<Text color="green">
				{t('startup.running', {count: entries.filter(entry => entry.running && entry.enabled).length})}
			</Text>
			<Text dimColor> - </Text>
			<Text color="yellow">
				{t('startup.disabled', {count: entries.filter(entry => !entry.enabled).length})}
			</Text>
			<Text dimColor> - </Text>
			<Text color="red">
				{t('startup.missing', {count: entries.filter(entry => !entry.executableExists).length})}
			</Text>
			<Text dimColor>
				{'  '}
				{filter}/{sort}
				{includeTasks ? ' +tasks' : ''}
			</Text>
		</Text>
	);
}

function ResidueSummary({residue, residueSelectedCount, deep, t}: SummaryProps) {
	return (
		<Text>
			<Text bold>{t('residue.summary', {total: residue?.findings.length ?? 0})}</Text>
			<Text dimColor> - </Text>
			<Text color="cyan">{t('residue.selected', {count: residueSelectedCount})}</Text>
			{deep ? <Text dimColor> deep</Text> : null}
		</Text>
	);
}

function JunkSummary({junkFindings, junkSelected, t}: SummaryProps) {
	const total = junkFindings.reduce((sum, finding) => sum + finding.sizeBytes, 0);
	const selected = junkSelected.reduce((sum, finding) => sum + finding.sizeBytes, 0);
	return (
		<Text>
			<Text bold>{t('junk.summary', {total: junkFindings.length})}</Text>
			<Text dimColor> - </Text>
			<Text color="green">{t('junk.reclaimable', {size: formatBytes(total)})}</Text>
			<Text dimColor> - </Text>
			<Text color="cyan">{t('junk.selectedSize', {size: formatBytes(selected)})}</Text>
		</Text>
	);
}

function HardwareSummary({hardware, t}: SummaryProps) {
	return (
		<Text>
			<Text bold>{t('hardware.recommendations')}</Text>
			<Text dimColor> - </Text>
			<Text>{hardware?.recommendations.length ?? 0}</Text>
			{hardware ? (
				<Text dimColor>
					{'  '}
					{t('hardware.deviceCount', {count: hardware.report.drivers.length})}
				</Text>
			) : null}
		</Text>
	);
}

export interface HelpOverlayProps {
	readonly bindings: ReadonlyArray<{keys: string; description: string}>;
	readonly title: string;
}

export function HelpOverlay({bindings, title}: HelpOverlayProps) {
	return (
		<Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginX={1}>
			<Text bold color="cyan">
				{title}
			</Text>
			{bindings.map(binding => (
				<Box key={binding.keys}>
					<Box width={16}>
						<Text color="yellow">{binding.keys}</Text>
					</Box>
					<Text dimColor>{binding.description}</Text>
				</Box>
			))}
		</Box>
	);
}
