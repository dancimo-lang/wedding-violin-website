'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { AdminButton } from '@/components/admin/AdminButton';
import { deleteLead } from '@/lib/delete-lead-client';

type DeleteLeadButtonProps = {
  leadId: string;
  clientName: string;
  placement: 'section' | 'row';
  onDeleted: () => void;
};

export function DeleteLeadButton({ leadId, clientName, placement, onDeleted }: DeleteLeadButtonProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const name = clientName.trim() || 'This client';

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    return () => {
      previouslyFocused?.focus();
    };
  }, [open]);

  const close = () => {
    if (pending) return;
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = [...dialogRef.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const confirm = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError('');
    const result = await deleteLead(leadId);
    if (!result.ok) {
      pendingRef.current = false;
      setError(result.error);
      setPending(false);
      return;
    }
    setOpen(false);
    onDeleted();
  };

  return (
    <>
      {placement === 'section' ? (
        <section className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6">
          <h3 className="text-lg font-semibold text-red-950">Remove this inquiry</h3>
          <p className="mt-2 text-sm text-red-900">
            Delete is for a test or junk inquiry. Archive only hides it, and cancelling a booking keeps the timeline.
          </p>
          <AdminButton
            type="button"
            variant="danger"
            className="mt-4"
            onClick={() => {
              pendingRef.current = false;
              setPending(false);
              setError('');
              setOpen(true);
            }}
          >
            Delete inquiry
          </AdminButton>
        </section>
      ) : (
        <AdminButton
          type="button"
          variant="danger"
          size="sm"
          onClick={() => {
            pendingRef.current = false;
            setPending(false);
            setError('');
            setOpen(true);
          }}
        >
          Delete
        </AdminButton>
      )}
      {open && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={close}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg"
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={onKeyDown}
          >
            <h3 id={titleId} className="text-xl font-bold text-gray-900">
              Delete this inquiry?
            </h3>
            <p id={descriptionId} className="mt-3 text-sm text-gray-700">
              This permanently removes {name}&apos;s inquiry, its bookings, contracts (including signed agreements), payment obligations, payments, and the timeline. If this client has no other inquiries or bookings, their client record is removed too. This cannot be undone.
            </p>
            {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <AdminButton ref={cancelRef} type="button" variant="secondary" onClick={close} disabled={pending}>
                Cancel
              </AdminButton>
              <AdminButton type="button" variant="danger" onClick={() => void confirm()} disabled={pending}>
                {pending ? 'Deleting...' : 'Delete inquiry'}
              </AdminButton>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
