/**
 * `useConfirm` — a promise-based confirmation dialog.
 *
 * `Alert.alert` is a no-op on React Native Web (react-native-web stubs it to an
 * empty function), so every confirm that used it silently did nothing in the web
 * preview. This renders the app's own bottom sheet instead — the same shell as
 * the form and range sheets — and resolves `true` only when the user confirms,
 * so it behaves the same on iOS, Android and web.
 *
 *   const { confirm, sheet: confirmSheet } = useConfirm();
 *   ...
 *   if (await confirm({ title: 'Delete it?', message: 'This cannot be undone.' })) remove();
 *   ...
 *   return <> … {confirmSheet} </>;
 *
 * Answers are promises so a call site reads as a straight question with a yes/no
 * branch rather than a callback nest. Fire-and-forget messages pass `cancelable:
 * false` for a single-button acknowledgement.
 */

import { useCallback, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ConfirmOptions {
  title: string;
  message?: string;
  /** Confirm button label. Defaults to `Delete`. */
  confirmLabel?: string;
  /** Cancel button label. Defaults to `Cancel`. */
  cancelLabel?: string;
  /** Confirm button tone. Defaults to `danger`. */
  tone?: 'danger' | 'primary';
  /**
   * `false` drops the cancel button for a single-button acknowledgement — for
   * "this cannot be done" messages rather than a yes/no question.
   */
  cancelable?: boolean;
}

type Pending = ConfirmOptions & { resolve: (confirmed: boolean) => void };

export function useConfirm(): {
  /** Ask a question; resolves `true` when the user confirms. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Mount this once, anywhere in the screen. */
  sheet: ReactNode;
} {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...options, resolve });
      }),
    [],
  );

  // Resolve the promise and unmount the sheet in one step. `pending` is captured
  // from this render, so there is no state-updater side effect to go stale.
  const sheet = pending ? (
    <ConfirmSheet
      title={pending.title}
      message={pending.message}
      confirmLabel={pending.confirmLabel ?? 'Delete'}
      cancelLabel={pending.cancelLabel ?? 'Cancel'}
      tone={pending.tone ?? 'danger'}
      cancelable={pending.cancelable ?? true}
      onConfirm={() => {
        pending.resolve(true);
        setPending(null);
      }}
      onCancel={() => {
        pending.resolve(false);
        setPending(null);
      }}
    />
  ) : null;

  return { confirm, sheet };
}

/** The dialog itself: the app's sheet shell with a title, message and actions. */
function ConfirmSheet({
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone,
  cancelable,
  onConfirm,
  onCancel,
}: {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: 'danger' | 'primary';
  cancelable: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const theme = useTheme();

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.modalRoot}>
        <Pressable accessibilityLabel="Dismiss" style={styles.backdrop} onPress={onCancel} />
        <Pressable
          accessibilityViewIsModal
          accessibilityRole="none"
          style={[styles.sheet, { backgroundColor: theme.surface }]}
          onPress={(event: { stopPropagation: () => void }) => event.stopPropagation()}
        >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          <View style={styles.content}>
            <Text style={[text.subtitle, { color: theme.ink }]}>{title}</Text>
            {message ? (
              <Text style={[text.body, { color: theme.muted }]}>{message}</Text>
            ) : null}
          </View>

          <View style={styles.actions}>
            {cancelable ? (
              <Button label={cancelLabel} variant="secondary" onPress={onCancel} />
            ) : null}
            <Button
              label={confirmLabel}
              variant={tone === 'danger' ? 'danger' : 'primary'}
              onPress={onConfirm}
            />
          </View>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  content: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
});
