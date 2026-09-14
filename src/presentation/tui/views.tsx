import {Box, Text} from 'ink';
import type {JunkFinding} from '@/domain/junk';
import type {Recommendation} from '@/domain/recommendation';
import type {ResidueFinding} from '@/domain/residue';
import type {HardwareReport} from '@/domain/hardware';
import type {StartupEntry} from '@/domain/startup';
import {statusOf} from '@/domain/startup';
import {translate, type Translator} from '@/i18n/translator';
import {formatBytes, formatCount, formatDate, pad, padStart, truncate} from '@/shared/format';
import {
	Empty,
	Field,
	IMPACT_COLORS,
	MARKS,
	Panel,
	RISK_COLORS,
	STATUS_COLORS,
	ScrollIndicator,
	TableHeader,
	visibleWindow,
	type Column,
} from '@/presentation/tui/components';

interface ListProps {
	readonly cursor: number;
	readonly height: number;
	readonly width: number;
	readonly t: Translator;
}

function statusMark(status: string): string {
	switch (status) {
		case 'running':
			return MARKS.running;
		case 'disabled':
			return MARKS.disabled;
		case 'missing':
			return MARKS.missing;
		default:
			return MARKS.stopped;
	}
}

// ---------------------------------------------------------------- startup ---

export function StartupList({
	entries,
	cursor,
	height,
	width,
	t,
}: ListProps & {entries: readonly StartupEntry[]}) {
	const sourceWidth = width >= 86 ? 24 : 0;
	const publisherWidth = width >= 112 ? 24 : 0;
	const nameWidth = Math.max(14, width - 4 - sourceWidth - publisherWidth - 20);

	const columns: Column[] = [
		{key: 'name', label: t('startup.columns.name'), width: nameWidth},
		...(sourceWidth ? [{key: 'source', label: t('startup.columns.source'), width: sourceWidth}] : []),
		{key: 'status', label: t('startup.columns.status'), width: 11},
		{key: 'memory', label: t('startup.columns.memory'), width: 9},
		...(publisherWidth
			? [{key: 'publisher', label: t('startup.columns.publisher'), width: publisherWidth}]
			: []),
	];

	if (entries.length === 0) return <Empty message={t('startup.empty')} />;

	const {start, slice} = visibleWindow(entries, cursor, height);

	return (
		<Box flexDirection="column">
			<TableHeader columns={columns} indent={2} />
			{slice.map((entry, index) => {
				const selected = start + index === cursor;
				const status = statusOf(entry);
				const color = STATUS_COLORS[status];
				return (
					<Box key={entry.id} paddingX={1}>
						<Text backgroundColor={selected ? 'blue' : undefined} color={selected ? 'white' : undefined}>
							<Text color={selected ? 'white' : color}>{statusMark(status)} </Text>
							{pad(entry.name, nameWidth)}
							{sourceWidth ? pad(t(`startup.source.${entry.source}`), sourceWidth) : ''}
							<Text color={selected ? 'white' : color}>{pad(t(`startup.status.${status}`), 11)}</Text>
							{pad(entry.running ? formatBytes(entry.memoryBytes) : '-', 9)}
							{publisherWidth ? pad(entry.publisher ?? '-', publisherWidth) : ''}
						</Text>
					</Box>
				);
			})}
			{entries.length > height && <ScrollIndicator cursor={cursor} total={entries.length} width={width} />}
		</Box>
	);
}

export function StartupDetail({
	entry,
	width,
	t,
}: {
	entry: StartupEntry | undefined;
	width: number;
	t: Translator;
}) {
	if (!entry) return <Panel>{<Text dimColor>{t('app.nothingSelected')}</Text>}</Panel>;

	const status = statusOf(entry);
	const color = STATUS_COLORS[status] ?? 'gray';
	const valueWidth = Math.max(20, width - 16);

	const processes =
		entry.pids.length > 0
			? [
					t(entry.pids.length === 1 ? 'startup.detail.processCount' : 'startup.detail.processCountPlural', {
						count: entry.pids.length,
					}),
					`pid ${entry.pids.slice(0, 6).join(', ')}${entry.pids.length > 6 ? '...' : ''}`,
					formatBytes(entry.memoryBytes),
					entry.matchReason
						? t('startup.detail.matchedBy', {reason: t(`startup.match.${entry.matchReason}`)})
						: '',
				]
					.filter(Boolean)
					.join(' - ')
			: t('startup.detail.notRunning');

	return (
		<Panel
			color={color}
			title={
				<Text>
					<Text bold color={color}>
						{statusMark(status)} {truncate(entry.name, valueWidth)}
					</Text>
					<Text dimColor> - {t(`startup.source.${entry.source}`)}</Text>
				</Text>
			}
		>
			<Field
				label={t('startup.detail.status')}
				value={`${t(`startup.status.${status}`)}${entry.enabled ? '' : ` (${t('startup.detail.startupSkipped')})`}`}
				color={color}
			/>
			<Field label={t('startup.detail.command')} value={truncate(entry.command, valueWidth)} />
			<Field
				label={t('startup.detail.executable')}
				value={truncate(entry.executablePath ?? '-', valueWidth)}
				color={entry.executableExists ? undefined : 'red'}
			/>
			<Field
				label={t('startup.detail.publisher')}
				value={truncate(entry.publisher ?? t('startup.detail.unknown'), valueWidth)}
			/>
			<Field label={t('startup.detail.processes')} value={truncate(processes, valueWidth)} />
			<Field label={t('startup.detail.registered')} value={truncate(entry.location, valueWidth)} />
			<Field
				label={t('startup.detail.file')}
				value={
					entry.executableExists
						? `${formatBytes(entry.fileSizeBytes)} - ${t('startup.detail.modified', {date: formatDate(entry.modifiedAt)})}`
						: t('startup.detail.missingOnDisk')
				}
				color={entry.executableExists ? undefined : 'red'}
			/>
		</Panel>
	);
}

// --------------------------------------------------------------- leftovers ---

export function ResidueList({
	findings,
	checked,
	cursor,
	height,
	width,
	t,
}: ListProps & {findings: readonly ResidueFinding[]; checked: ReadonlySet<string>}) {
	if (findings.length === 0) return <Empty message={t('residue.empty')} hint={t('residue.emptyHint')} />;

	const kindWidth = width >= 82 ? 22 : 0;
	const sizeWidth = width >= 98 ? 9 : 0;
	const titleWidth = Math.max(16, Math.floor((width - 6 - kindWidth - sizeWidth) * 0.45));
	const evidenceWidth = Math.max(0, width - 6 - kindWidth - sizeWidth - titleWidth);

	const columns: Column[] = [
		{key: 'title', label: t('residue.columns.leftover'), width: titleWidth},
		...(kindWidth ? [{key: 'kind', label: t('residue.columns.kind'), width: kindWidth}] : []),
		...(sizeWidth ? [{key: 'size', label: t('residue.columns.size'), width: sizeWidth}] : []),
		...(evidenceWidth ? [{key: 'evidence', label: t('residue.columns.pointsAt'), width: evidenceWidth}] : []),
	];

	const {start, slice} = visibleWindow(findings, cursor, height);

	return (
		<Box flexDirection="column">
			<TableHeader columns={columns} />
			{slice.map((finding, index) => {
				const selected = start + index === cursor;
				const isChecked = checked.has(finding.id);
				const color = RISK_COLORS[finding.risk];
				return (
					<Box key={finding.id} paddingX={1}>
						<Text backgroundColor={selected ? 'blue' : undefined} color={selected ? 'white' : undefined}>
							<Text color={selected ? 'white' : isChecked ? 'cyan' : undefined}>
								{isChecked ? MARKS.selected : MARKS.unselected}{' '}
							</Text>
							{pad(finding.title, titleWidth)}
							{kindWidth ? (
								<Text color={selected ? 'white' : color}>
									{pad(t(`residue.classes.${finding.residueClass}`), kindWidth)}
								</Text>
							) : null}
							{sizeWidth ? pad(finding.sizeBytes > 0 ? formatBytes(finding.sizeBytes) : '-', sizeWidth) : ''}
							{evidenceWidth ? (
								<Text dimColor={!selected}>{truncate(finding.evidence ?? '', evidenceWidth)}</Text>
							) : null}
						</Text>
					</Box>
				);
			})}
			{findings.length > height && <ScrollIndicator cursor={cursor} total={findings.length} width={width} />}
		</Box>
	);
}

export function ResidueDetail({
	finding,
	width,
	t,
}: {
	finding: ResidueFinding | undefined;
	width: number;
	t: Translator;
}) {
	if (!finding) return <Panel>{<Text dimColor>{t('app.nothingSelected')}</Text>}</Panel>;

	const color = RISK_COLORS[finding.risk] ?? 'gray';
	const valueWidth = Math.max(20, width - 16);

	return (
		<Panel
			color={color}
			title={
				<Text>
					<Text bold color={color}>
						{truncate(finding.title, valueWidth)}
					</Text>
					<Text dimColor> - {t(`residue.classes.${finding.residueClass}`)}</Text>
					{finding.elevation === 'administrator' ? (
						<Text color="yellow"> - {t('residue.detail.needsAdmin')}</Text>
					) : null}
				</Text>
			}
		>
			<Field label={t('residue.detail.why')} value={truncate(translate(t, finding.reason), valueWidth)} />
			<Field
				label={t('residue.detail.pointsAt')}
				value={truncate(finding.evidence ?? '-', valueWidth)}
				color="red"
			/>
			<Field
				label={t('residue.detail.removes')}
				value={truncate(`${finding.removal.kind}: ${finding.removal.target}`, valueWidth)}
			/>
			<Field
				label={t('residue.detail.risk')}
				value={finding.risk === 'safe' ? t('residue.detail.riskSafe') : t('residue.detail.riskReview')}
				color={color}
			/>
			<Field label={t('residue.detail.recovery')} value={t('residue.detail.recoveryNote')} />
		</Panel>
	);
}

// --------------------------------------------------------------------- junk ---

export function JunkList({
	findings,
	checked,
	cursor,
	height,
	width,
	t,
}: ListProps & {findings: readonly JunkFinding[]; checked: ReadonlySet<string>}) {
	if (findings.length === 0) return <Empty message={t('junk.empty')} />;

	const categoryWidth = width >= 90 ? 26 : 0;
	const nameWidth = Math.max(18, width - 6 - categoryWidth - 22);

	const columns: Column[] = [
		{key: 'location', label: t('junk.columns.location'), width: nameWidth},
		...(categoryWidth ? [{key: 'category', label: t('junk.columns.category'), width: categoryWidth}] : []),
		{key: 'files', label: t('junk.columns.files'), width: 10},
		{key: 'size', label: t('junk.columns.size'), width: 10},
	];

	const {start, slice} = visibleWindow(findings, cursor, height);

	return (
		<Box flexDirection="column">
			<TableHeader columns={columns} />
			{slice.map((finding, index) => {
				const selected = start + index === cursor;
				const isChecked = checked.has(finding.target.id);
				const color = RISK_COLORS[finding.target.risk];
				return (
					<Box key={finding.target.id} paddingX={1}>
						<Text backgroundColor={selected ? 'blue' : undefined} color={selected ? 'white' : undefined}>
							<Text color={selected ? 'white' : isChecked ? 'cyan' : undefined}>
								{isChecked ? MARKS.selected : MARKS.unselected}{' '}
							</Text>
							{pad(finding.target.id, nameWidth)}
							{categoryWidth ? (
								<Text color={selected ? 'white' : color}>
									{pad(t(`junk.categories.${finding.target.category}`), categoryWidth)}
								</Text>
							) : null}
							{padStart(formatCount(finding.fileCount), 9) + ' '}
							{padStart(formatBytes(finding.sizeBytes), 10)}
						</Text>
					</Box>
				);
			})}
			{findings.length > height && <ScrollIndicator cursor={cursor} total={findings.length} width={width} />}
		</Box>
	);
}

export function JunkDetail({
	finding,
	width,
	t,
}: {
	finding: JunkFinding | undefined;
	width: number;
	t: Translator;
}) {
	if (!finding) return <Panel>{<Text dimColor>{t('app.nothingSelected')}</Text>}</Panel>;

	const color = RISK_COLORS[finding.target.risk] ?? 'gray';
	const valueWidth = Math.max(20, width - 16);

	return (
		<Panel
			color={color}
			title={
				<Text>
					<Text bold color={color}>
						{truncate(finding.target.id, valueWidth)}
					</Text>
					<Text dimColor> - {t(`junk.categories.${finding.target.category}`)}</Text>
					{finding.target.elevation === 'administrator' ? (
						<Text color="yellow"> - {t('residue.detail.needsAdmin')}</Text>
					) : null}
				</Text>
			}
		>
			<Field
				label={t('residue.detail.why')}
				value={truncate(translate(t, finding.target.description), valueWidth)}
			/>
			<Field label={t('junk.columns.location')} value={truncate(finding.resolvedPath, valueWidth)} />
			<Field
				label={t('junk.columns.size')}
				value={`${formatBytes(finding.sizeBytes)} - ${formatCount(finding.fileCount)} ${t('junk.columns.files').toLowerCase()}`}
			/>
			<Field
				label={t('residue.detail.risk')}
				value={finding.target.risk === 'safe' ? t('junk.riskSafe') : t('junk.riskReview')}
				color={color}
			/>
			<Field label={t('residue.detail.recovery')} value={t('junk.notReversible')} color="yellow" />
			{finding.note ? <Field label="" value={translate(t, finding.note)} color="yellow" /> : null}
		</Panel>
	);
}

// ----------------------------------------------------------------- hardware ---

export function HardwareList({
	recommendations,
	cursor,
	height,
	width,
	t,
}: ListProps & {recommendations: readonly Recommendation[]}) {
	if (recommendations.length === 0) return <Empty message={t('hardware.noRecommendations')} />;

	const impactWidth = 12;
	const areaWidth = width >= 90 ? 12 : 0;
	const titleWidth = Math.max(20, width - 4 - impactWidth - areaWidth);

	const {start, slice} = visibleWindow(recommendations, cursor, height);

	return (
		<Box flexDirection="column">
			<TableHeader
				columns={[
					{key: 'impact', label: t('hardware.columns.impact'), width: impactWidth},
					...(areaWidth ? [{key: 'area', label: t('hardware.columns.area'), width: areaWidth}] : []),
					{key: 'title', label: t('hardware.columns.title'), width: titleWidth},
				]}
				indent={2}
			/>
			{slice.map((item, index) => {
				const selected = start + index === cursor;
				const color = IMPACT_COLORS[item.impact];
				return (
					<Box key={item.id} paddingX={1}>
						<Text backgroundColor={selected ? 'blue' : undefined} color={selected ? 'white' : undefined}>
							{'  '}
							<Text color={selected ? 'white' : color} bold>
								{pad(t(`hardware.impact.${item.impact}`), impactWidth)}
							</Text>
							{areaWidth ? <Text dimColor={!selected}>{pad(item.area, areaWidth)}</Text> : null}
							{pad(translate(t, item.title), titleWidth)}
						</Text>
					</Box>
				);
			})}
			{recommendations.length > height && (
				<ScrollIndicator cursor={cursor} total={recommendations.length} width={width} />
			)}
		</Box>
	);
}

export function HardwareDetail({
	item,
	report,
	width,
	t,
}: {
	item: Recommendation | undefined;
	report: HardwareReport | null;
	width: number;
	t: Translator;
}) {
	const valueWidth = Math.max(20, width - 16);

	if (!item) {
		if (!report) return <Panel>{<Text dimColor>{t('app.nothingSelected')}</Text>}</Panel>;
		return (
			<Panel
				color="cyan"
				title={
					<Text bold color="cyan">
						{t('hardware.system')}
					</Text>
				}
			>
				<Field label={t('hardware.cpu')} value={truncate(report.capabilities.cpuBrand, valueWidth)} />
				<Field
					label={t('hardware.memory')}
					value={`${formatBytes(report.capabilities.memoryTotalBytes)} (${formatBytes(report.capabilities.memoryFreeBytes)} ${t('hardware.free')})`}
				/>
				<Field
					label={t('hardware.graphics')}
					value={truncate(
						report.graphics.controllers.map(controller => controller.model).join(' | ') || '-',
						valueWidth,
					)}
				/>
			</Panel>
		);
	}

	const color = IMPACT_COLORS[item.impact] ?? 'gray';

	return (
		<Panel
			color={color}
			title={
				<Text>
					<Text bold color={color}>
						{truncate(translate(t, item.title), valueWidth)}
					</Text>
					<Text dimColor> - {t(`hardware.impact.${item.impact}`)}</Text>
				</Text>
			}
		>
			<Field label={t('hardware.detail.finding')} value={truncate(translate(t, item.finding), valueWidth)} />
			<Field label={t('hardware.detail.advice')} value={truncate(translate(t, item.advice), valueWidth)} />
			{item.action ? (
				<Field
					label={t('hardware.detail.where')}
					value={truncate(translate(t, item.action.location), valueWidth)}
				/>
			) : null}
			{item.action?.command ? (
				<Field
					label={t('hardware.detail.command')}
					value={truncate(item.action.command, valueWidth)}
					color="cyan"
				/>
			) : null}
			{item.evidence.length > 0 ? (
				<Field
					label={t('hardware.detail.evidence')}
					value={truncate(item.evidence.join(' ; '), valueWidth)}
				/>
			) : null}
		</Panel>
	);
}
