import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { ApiError } from '@pluto/api-client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorNote, Spinner } from '@/components/ui/feedback';
import { AppPageHeader } from '@/components/ui/page-header';
import { TextField } from '@/components/ui/text-field';
import { IconAlert, IconCheck, IconTrash } from '@/components/icons';
import { borderWidth, layout, radius, spacing, text } from '@/theme';
import { useBackupDownload, useBackups } from '@/hooks/use-backups';
import { useScreenPadding } from '@/hooks/use-screen-padding';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { deleteAccount } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatBytes, formatDate } from '@/lib/format';

/** The phrase the user must type before the destructive button unlocks. */
const CONFIRM_PHRASE = 'DELETE';

/** What the server removes, spelled out before the button is reachable. */
const CONSEQUENCES = [
  'Your profile (email, name and avatar) is erased.',
  'Every cloud backup stored for your account is deleted — permanently and irreversibly.',
  'All active sessions and tokens are revoked immediately.',
] as const;

/**
 * The same list when cloud backup is switched off on the server: promising to
 * delete backups that were never stored would be untrue, and the honesty of this
 * screen is the whole point of it.
 */
const CONSEQUENCES_WITHOUT_BACKUPS = [
  CONSEQUENCES[0],
  CONSEQUENCES[2],
] as const;

/**
 * Account deletion, in the app — the Play Store requirement the web's
 * `/delete-account` page answers for the website.
 *
 * The flow mirrors that page step for step: what will happen, an optional
 * download of the backups that are about to be destroyed, then a typed
 * confirmation. The typed phrase (not a tap) is deliberate: this is the one
 * action in the app that cannot be undone, and a stray tap on a bottom sheet is
 * not enough consent for it.
 *
 * On success `deleteAccount` clears the local session, which flips the tab
 * shell to its signed-out guard — so the only navigation this screen owns is
 * the explicit return to the sign-in screen from its "done" state.
 */
export default function DeleteAccountScreen() {
  const theme = useTheme();
  const screenPadding = useScreenPadding();
  const { user } = useSession();
  const backups = useBackups();
  const download = useBackupDownload();

  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completed = useMemo(
    () => (backups.data?.items ?? []).filter((backup) => backup.status === 'COMPLETED'),
    [backups.data],
  );

  /**
   * Cloud backups are an opt-in server feature: with `OBJECT_STORAGE_ENABLED`
   * off, every `/backups` route answers `503`. That is a *configuration*, not a
   * failure, so it must not paint the alarming error note a real outage
   * deserves — least of all on the screen where the user is already deciding to
   * delete their account. A 503 therefore reads as "no backups are stored for
   * you", which is exactly what the account has.
   */
  const backupsUnavailable = backups.error instanceof ApiError && backups.error.status === 503;

  const onDownload = useCallback(
    (id: string) => {
      setError(null);
      download.mutate(id, {
        onSuccess: (result) => {
          // The presigned URL carries its own authority and expires in minutes,
          // so the system browser opens it directly — no header, no download
          // manager to plumb through React Native.
          void openBrowserAsync(result.downloadUrl);
        },
        onError: (cause) => setError(errorMessage(cause) ?? 'Could not prepare the download.'),
      });
    },
    [download],
  );

  const onDelete = useCallback(() => {
    if (confirmText !== CONFIRM_PHRASE || deleting) return;
    setError(null);
    setDeleting(true);
    // Navigation follows the session: clearing it signs the app out, and the
    // sign-in screen is pushed explicitly below because this screen sits
    // outside the guarded tab shell.
    deleteAccount()
      .then(() => setDeleted(true))
      .catch((cause: unknown) => setError(errorMessage(cause) ?? 'Account deletion failed.'))
      .finally(() => setDeleting(false));
  }, [confirmText, deleting]);

  if (deleted) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: theme.canvas }]}
        contentContainerStyle={[styles.content, screenPadding]}
      >
        <Card>
          <View style={styles.doneRow}>
            <View style={[styles.doneBadge, { backgroundColor: theme.successSubtle }]}>
              <IconCheck size={20} color={theme.success} />
            </View>
            <Text style={[text.subtitle, { color: theme.ink }]}>Your account has been deleted</Text>
          </View>
          <Text style={[text.body, { color: theme.muted }]}>
            {backupsUnavailable
              ? 'Your profile and all active sessions have been permanently removed. Thank you for using Pluto.'
              : 'Your profile, cloud backups and all active sessions have been permanently removed. Thank you for using Pluto.'}
          </Text>
          <Button label="Back to sign in" onPress={() => router.replace('/sign-in')} />
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.canvas }]}
      contentContainerStyle={[styles.content, screenPadding]}
      keyboardShouldPersistTaps="handled"
    >
      <AppPageHeader
        title="Delete account"
        subtitle="Permanently removes your account and everything stored for it."
      />

      <Card>
        <Text style={[text.overline, { color: theme.muted }]}>SIGNED IN AS</Text>
        <Text numberOfLines={1} style={[text.bodyStrong, { color: theme.ink }]}>
          {user?.name ?? 'Pluto user'}
        </Text>
        <Text numberOfLines={1} style={[text.body, { color: theme.muted }]}>
          {user?.email ?? '—'}
        </Text>
      </Card>

      <Card>
        <Text style={[text.overline, { color: theme.muted }]}>BEFORE YOU CONTINUE</Text>
        <Text style={[text.body, { color: theme.muted }]}>
          This permanently deletes the following, with no way to restore any of it:
        </Text>
        {(backupsUnavailable ? CONSEQUENCES_WITHOUT_BACKUPS : CONSEQUENCES).map((consequence) => (
          <View key={consequence} style={styles.consequence}>
            <View style={styles.consequenceDot}>
              <IconAlert size={14} color={theme.danger} />
            </View>
            <Text style={[text.body, styles.flex, { color: theme.muted }]}>{consequence}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={[text.overline, { color: theme.muted }]}>DOWNLOAD A COPY (OPTIONAL)</Text>
        {backups.isPending ? (
          <Spinner style={styles.spinner} />
        ) : backupsUnavailable ? (
          <Text style={[text.body, { color: theme.muted }]}>
            Cloud backup is not enabled, so there is no copy stored on the server to download.
            Your expenses live on this device.
          </Text>
        ) : backups.isError ? (
          <ErrorNote message={errorMessage(backups.error) ?? 'Could not load your backups.'} />
        ) : completed.length === 0 ? (
          <Text style={[text.body, { color: theme.muted }]}>You have no completed backups.</Text>
        ) : (
          <>
            <Text style={[text.body, { color: theme.muted }]}>
              Deletion destroys your backups. Download any you want to keep first.
            </Text>
            {completed.map((backup) => (
              <View key={backup.id} style={[styles.backupRow, { borderColor: theme.border }]}>
                <View style={styles.flex}>
                  <Text numberOfLines={1} style={[text.bodyMedium, { color: theme.ink }]}>
                    Backup #{backup.sequenceNumber} · v{backup.appVersion}
                  </Text>
                  <Text style={[text.caption, { color: theme.muted }]}>
                    {formatDate(backup.createdAt.slice(0, 10))} ·{' '}
                    {formatBytes(backup.fileSizeBytes)}
                  </Text>
                </View>
                <Button
                  label="Download"
                  variant="secondary"
                  size="sm"
                  busy={download.isPending && download.variables === backup.id}
                  disabled={download.isPending}
                  onPress={() => onDownload(backup.id)}
                />
              </View>
            ))}
          </>
        )}
      </Card>

      <Card>
        <Text style={[text.overline, { color: theme.danger }]}>CONFIRM</Text>
        <Text style={[text.body, { color: theme.muted }]}>
          This action is immediate and irreversible.
          {backupsUnavailable ? ' Your account and sessions will be destroyed.' : ' All backups will be destroyed.'}
        </Text>
        <TextField
          label={`Type ${CONFIRM_PHRASE} to confirm`}
          value={confirmText}
          onChangeText={setConfirmText}
          autoCapitalize="characters"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          placeholder={CONFIRM_PHRASE}
          editable={!deleting}
        />
        {error ? <ErrorNote message={error} /> : null}
        <Button
          label="Permanently delete my account"
          variant="danger"
          icon={(color) => <IconTrash size={16} color={color} />}
          onPress={onDelete}
          busy={deleting}
          disabled={confirmText !== CONFIRM_PHRASE}
          style={styles.delete}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: layout.gutter,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  flex: { flex: 1 },
  spinner: { alignSelf: 'flex-start' },
  consequence: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  consequenceDot: { paddingTop: 3 },
  backupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: borderWidth.hairline,
    paddingVertical: spacing.md,
  },
  delete: { marginTop: spacing.xs },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  doneBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
