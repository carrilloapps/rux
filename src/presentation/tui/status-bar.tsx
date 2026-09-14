import {Box, Text} from 'ink';
import type {JunkFinding} from '@/domain/junk';
import type {ResidueFinding} from '@/domain/residue';
import type {StartupEntry} from '@/domain/startup';
import type {Translator} from '@/i18n/translator';

/** An action awaiting confirmation. */
export type Pending =
	| {kind: 'startup'; mutation: 'enable' | 'disable' | 'remove'; entry: StartupEntry}
	| {kind: 'residue'; findings: readonly ResidueFinding[]}
	| {kind: 'junk'; findings: readonly JunkFinding[]};

export interface StatusBarProps {
	readonly mode: 'list' | 'search' | 'confirm' | 'help';
	readonly pending: Pending | null;
	readonly query: string;
	readonly busy: boolean;
	readonly status: {text: string; tone: 'info' | 'error' | 'success'} | null;
	readonly t: Translator;
}

/**
 * The bottom line: search input, a confirmation prompt, progress, the last
 * result, or the key hints, in that order of precedence.
 */
export function StatusBar({mode, pending, query, busy, status, t}: StatusBarProps) {
	if (mode === 'search') {
		return (
			<Box paddingX={1}>
				<Text>
					<Text color="cyan">/</Text>
					{query}
					<Text color="cyan">_</Text>
				</Text>
			</Box>
		);
	}

	if (mode === 'confirm' && pending) {
		return (
			<Box paddingX={1}>
				<Text>
					<Text color="red" bold>
						{confirmQuestion(pending, t)}
					</Text>
					<Text dimColor> {confirmNote(pending, t)}</Text>
					<Text> </Text>
					<Text color="green">y</Text>
					<Text dimColor> / </Text>
					<Text color="red">n</Text>
				</Text>
			</Box>
		);
	}

	return (
		<Box paddingX={1}>
			{busy ? (
				<Text color="cyan">{t('app.working')}</Text>
			) : status ? (
				<Text color={status.tone === 'error' ? 'red' : status.tone === 'success' ? 'green' : undefined}>
					{status.text}
				</Text>
			) : (
				<Text dimColor>
					tab {t('keys.switchView')} - / {t('keys.search')} - l {t('keys.language')} - ? {t('app.help')} - q{' '}
					{t('app.quit')}
				</Text>
			)}
		</Box>
	);
}

function confirmQuestion(pending: Pending, t: Translator): string {
	if (pending.kind === 'startup') {
		return t(`startup.confirm.${pending.mutation}`, {name: pending.entry.name});
	}
	const count = pending.findings.length;
	if (pending.kind === 'residue') {
		return t(count === 1 ? 'residue.confirmRemove' : 'residue.confirmRemovePlural', {count});
	}
	return t(count === 1 ? 'junk.confirmClean' : 'junk.confirmCleanPlural', {count});
}

function confirmNote(pending: Pending, t: Translator): string {
	if (pending.kind === 'residue') return t('residue.backedUpFirst');
	if (pending.kind === 'junk') return t('junk.notReversible');
	return '';
}
