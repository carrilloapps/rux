import {Box, Text} from 'ink';
import type {HardwareAnalysis} from '@/application/use-cases';
import type {JunkFinding} from '@/domain/junk';
import type {Recommendation} from '@/domain/recommendation';
import type {ResidueFinding} from '@/domain/residue';
import type {StartupEntry} from '@/domain/startup';
import type {Translator} from '@/i18n/translator';
import type {View} from '@/presentation/tui/view';
import {
	HardwareDetail,
	HardwareList,
	JunkDetail,
	JunkList,
	ResidueDetail,
	ResidueList,
	StartupDetail,
	StartupList,
} from '@/presentation/tui/views';

export interface ViewData {
	readonly startup: readonly StartupEntry[];
	readonly residue: readonly ResidueFinding[];
	readonly junk: readonly JunkFinding[];
	readonly hardware: readonly Recommendation[];
}

export interface ViewBodyProps {
	readonly view: View;
	readonly data: ViewData;
	readonly cursor: number;
	readonly residueChecked: ReadonlySet<string>;
	readonly junkChecked: ReadonlySet<string>;
	readonly loading: boolean;
	readonly height: number;
	readonly width: number;
	readonly t: Translator;
}

/**
 * Renders the list for the active view.
 *
 * Each view has its own table because the columns differ in kind, not just in
 * width; sharing one generic table would mean a configuration object more
 * complicated than the four components it replaced.
 */
export function ViewBody(props: ViewBodyProps) {
	const {view, data, cursor, residueChecked, junkChecked, loading, height, width, t} = props;

	if (loading && countFor(view, data) === 0) {
		return (
			<Box paddingX={1} paddingY={1}>
				<Text color="cyan">{t('app.scanning')}</Text>
			</Box>
		);
	}

	switch (view) {
		case 'startup':
			return <StartupList entries={data.startup} cursor={cursor} height={height} width={width} t={t} />;
		case 'residue':
			return (
				<ResidueList
					findings={data.residue}
					checked={residueChecked}
					cursor={cursor}
					height={height}
					width={width}
					t={t}
				/>
			);
		case 'junk':
			return (
				<JunkList
					findings={data.junk}
					checked={junkChecked}
					cursor={cursor}
					height={height}
					width={width}
					t={t}
				/>
			);
		case 'hardware':
			return (
				<HardwareList recommendations={data.hardware} cursor={cursor} height={height} width={width} t={t} />
			);
	}
}

export interface DetailPaneProps {
	readonly view: View;
	readonly startup: StartupEntry | undefined;
	readonly residue: ResidueFinding | undefined;
	readonly junk: JunkFinding | undefined;
	readonly recommendation: Recommendation | undefined;
	readonly hardware: HardwareAnalysis | null;
	readonly width: number;
	readonly t: Translator;
}

/** The panel under the list, describing whatever the cursor is on. */
export function DetailPane(props: DetailPaneProps) {
	const {view, startup, residue, junk, recommendation, hardware, width, t} = props;

	return (
		<Box paddingX={1} flexDirection="column">
			{view === 'startup' ? <StartupDetail entry={startup} width={width} t={t} /> : null}
			{view === 'residue' ? <ResidueDetail finding={residue} width={width} t={t} /> : null}
			{view === 'junk' ? <JunkDetail finding={junk} width={width} t={t} /> : null}
			{view === 'hardware' ? (
				<HardwareDetail item={recommendation} report={hardware?.report ?? null} width={width} t={t} />
			) : null}
		</Box>
	);
}

export function countFor(view: View, data: ViewData): number {
	switch (view) {
		case 'startup':
			return data.startup.length;
		case 'residue':
			return data.residue.length;
		case 'junk':
			return data.junk.length;
		case 'hardware':
			return data.hardware.length;
	}
}
