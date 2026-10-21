import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';

// Confirmations (the mobile app's Alert.alert) and short toasts, for the
// whole app: `const ok = await confirm({...})`, `toast('Copied')`.

type ConfirmOptions = { title: string; message?: string; confirm: string; cancel?: string; destructive?: boolean };

type Dialogs = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (title: string, message?: string) => Promise<void>;
  toast: (message: string) => void;
};

const DialogsContext = createContext<Dialogs | null>(null);

type Open = ConfirmOptions & { alertOnly?: boolean; resolve: (ok: boolean) => void };

export function DialogsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<Open | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // showModal(): focus moves into the dialog, Esc closes it, the page behind is inert.
  useEffect(() => {
    if (open && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [open]);

  const close = useCallback(
    (ok: boolean) => {
      open?.resolve(ok);
      dialogRef.current?.close();
      setOpen(null);
    },
    [open],
  );

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => setOpen({ ...options, resolve })), []);
  const alert = useCallback(
    (title: string, message?: string) =>
      new Promise<void>((resolve) => setOpen({ title, message, confirm: 'OK', alertOnly: true, resolve: () => resolve() })),
    [],
  );
  const toast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastText(message);
    toastTimer.current = setTimeout(() => setToastText(null), 2500);
  }, []);

  const value = useMemo(() => ({ confirm, alert, toast }), [confirm, alert, toast]);

  return (
    <DialogsContext.Provider value={value}>
      {children}
      <dialog
        ref={dialogRef}
        className="dialog"
        aria-labelledby="dialog-title"
        onCancel={(e) => {
          e.preventDefault();
          close(false);
        }}
      >
        {open ? (
          <div className="stack-sm">
            <h2 id="dialog-title" className="heading">
              {open.title}
            </h2>
            {open.message ? <p className="muted">{open.message}</p> : null}
            <div className="dialog-actions">
              {open.alertOnly ? null : <Button title={open.cancel ?? 'Cancel'} variant="secondary" size="sm" onClick={() => close(false)} />}
              <Button title={open.confirm} variant={open.destructive ? 'danger' : 'primary'} size="sm" onClick={() => close(true)} />
            </div>
          </div>
        ) : null}
      </dialog>
      {toastText ? (
        <div className="toast" role="status">
          {toastText}
        </div>
      ) : null}
    </DialogsContext.Provider>
  );
}

export function useDialogs() {
  const ctx = useContext(DialogsContext);
  if (!ctx) throw new Error('useDialogs must be used inside <DialogsProvider>');
  return ctx;
}
