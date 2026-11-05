'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { downloadExtension } from '@/lib/tune-files';
import {
  TIP_MODAL_HEADING,
  TIP_MODAL_LINE,
  TIP_PRESET_CENTS,
  TIP_TEST_SITE_NOTE,
  dollarsToCents,
  readTipPromptSuppressed,
  writeTipPromptSuppressed,
} from '@/lib/payments/resource-tip';
import { darkButtonClass, goldButtonClass, outlineButtonClass, quietLinkClass } from '@/components/public-button';

export type TipDownload = {
  href: string;
  filename: string;
};

type Prompt = {
  open: boolean;
  download: TipDownload | null;
  customAmount: string;
  setCustomAmount: (value: string) => void;
  note: string;
  busy: boolean;
  requestDownload: (file: TipDownload) => void;
  openSupport: () => void;
  dismiss: () => void;
  decline: () => void;
  tip: (amountCents: number) => void;
  submitCustom: () => void;
};

function rememberDismissal() {
  try {
    writeTipPromptSuppressed(window.localStorage);
  } catch {
    // Private browsing can block storage. The download still proceeds.
  }
}

function startDownload(file: TipDownload) {
  const anchor = document.createElement('a');
  anchor.href = file.href;
  const sameOrigin = file.href.startsWith('/') || file.href.startsWith(window.location.origin);
  if (sameOrigin) {
    anchor.download = file.filename;
  } else {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function downloadName(id: string, path: string, fallbackExtension: string): string {
  const extension = downloadExtension(path) || fallbackExtension;
  return `${id}${extension}`;
}

export function useResourceTipPrompt(returnPath: string): Prompt {
  const [open, setOpen] = useState(false);
  const [download, setDownload] = useState<TipDownload | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  function requestDownload(file: TipDownload) {
    try {
      if (readTipPromptSuppressed(window.localStorage)) {
        startDownload(file);
        return;
      }
    } catch {
      // Show the prompt when storage cannot be read.
    }
    setDownload(file);
    setCustomAmount('');
    setNote('');
    setOpen(true);
  }

  function openSupport() {
    setDownload(null);
    setCustomAmount('');
    setNote('');
    setOpen(true);
  }

  function dismiss() {
    rememberDismissal();
    setOpen(false);
    setBusy(false);
  }

  function decline() {
    const file = download;
    dismiss();
    if (file) startDownload(file);
  }

  async function tip(amountCents: number) {
    setBusy(true);
    setNote('');
    try {
      const response = await fetch('/api/payments/resource-tip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents, returnPath }),
      });
      const data = (await response.json().catch(() => null)) as { testSite?: boolean; message?: string; url?: string; error?: string } | null;
      if (data?.testSite) {
        setNote(typeof data.message === 'string' ? data.message : TIP_TEST_SITE_NOTE);
        setBusy(false);
        return;
      }
      if (response.ok && typeof data?.url === 'string' && data.url.startsWith('https://')) {
        rememberDismissal();
        window.location.assign(data.url);
        return;
      }
      setNote(data?.error || 'The tip page could not be opened. The music is still free to download.');
    } catch {
      setNote('The tip page could not be opened. The music is still free to download.');
    }
    setBusy(false);
  }

  function submitCustom() {
    const cents = dollarsToCents(customAmount);
    if (cents == null) {
      setNote('Enter an amount from $1 to $200.');
      return;
    }
    void tip(cents);
  }

  return {
    open,
    download,
    customAmount,
    setCustomAmount,
    note,
    busy,
    requestDownload,
    openSupport,
    dismiss,
    decline,
    tip: (amountCents) => {
      void tip(amountCents);
    },
    submitCustom,
  };
}

export function SupportLessonsLink({ prompt }: { prompt: Prompt }) {
  return (
    <button type="button" className={quietLinkClass} onClick={prompt.openSupport}>
      Support these free lessons
    </button>
  );
}

export function ResourceTipDialog({ prompt }: { prompt: Prompt }) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const dismissRef = useRef(prompt.dismiss);

  useEffect(() => {
    dismissRef.current = prompt.dismiss;
  });

  useEffect(() => {
    if (!prompt.open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [prompt.open]);

  if (!prompt.open) return null;

  const amounts = TIP_PRESET_CENTS.map((cents) => ({ cents, label: `$${cents / 100}` }));

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-charcoal/60 p-4 sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) prompt.dismiss();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-cream-line bg-cream-card p-5 shadow-xl outline-none sm:p-6"
      >
        <h2 id={titleId} className="text-2xl font-semibold text-ink">
          {TIP_MODAL_HEADING}
        </h2>
        <p className="mt-2 text-ink-body">{TIP_MODAL_LINE}</p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {amounts.map((amount) => (
            <button
              key={amount.cents}
              type="button"
              className={goldButtonClass}
              disabled={prompt.busy}
              onClick={() => prompt.tip(amount.cents)}
            >
              {amount.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label className="block flex-1 text-sm font-medium text-ink">
            Other amount
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={prompt.customAmount}
              onChange={(event) => prompt.setCustomAmount(event.target.value)}
              placeholder="15"
              aria-label="Custom tip amount in dollars"
              className="mt-1 w-full rounded-xl border border-cream-line bg-cream px-3 py-2 font-normal text-ink focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </label>
          <button
            type="button"
            className={`${outlineButtonClass} sm:mt-6`}
            disabled={prompt.busy}
            onClick={prompt.submitCustom}
          >
            Tip
          </button>
        </div>
        <p className="mt-1 text-xs text-ink-soft">Enter an amount from $1 to $200.</p>

        {prompt.note ? (
          <p role="status" className="mt-4 rounded-xl border border-gold/50 bg-cream px-3 py-2 text-sm text-ink">
            {prompt.note}
          </p>
        ) : null}

        <button type="button" className={`${darkButtonClass} mt-5 w-full`} disabled={prompt.busy} onClick={prompt.decline}>
          {prompt.download ? 'No thanks, just download' : 'Not now'}
        </button>
      </div>
    </div>
  );
}
