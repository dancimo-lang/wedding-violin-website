'use client';

import { useEffect, useId, useState } from 'react';
import { fieldClass } from '@/lib/leads';
import type { VenueSuggestion } from '@/lib/venues/photon';

const labelClass = 'block text-sm font-semibold text-gray-900';

export function VenueNameField({
  name,
  address,
  onName,
  onAddress,
  nameRequired = false,
  addressRequired = false,
}: {
  name: string;
  address: string;
  onName: (value: string) => void;
  onAddress: (value: string) => void;
  nameRequired?: boolean;
  addressRequired?: boolean;
}) {
  const listId = useId();
  const [suggestions, setSuggestions] = useState<VenueSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'searching' | 'empty' | 'ready'>('idle');

  const query = name.trim();
  const visible = query.length >= 3 && status === 'ready' ? suggestions : [];

  useEffect(() => {
    if (query.length < 3) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) setStatus('searching');
      fetch(`/api/admin/venues?q=${encodeURIComponent(query)}`, { cache: 'no-store', credentials: 'same-origin' })
        .then(async (response) => {
          if (!response.ok) return [];
          const payload = (await response.json()) as { results?: VenueSuggestion[] };
          return Array.isArray(payload.results) ? payload.results : [];
        })
        .then((results) => {
          if (cancelled) return;
          const next = results.slice(0, 5);
          setSuggestions(next);
          setStatus(next.length > 0 ? 'ready' : 'empty');
        })
        .catch(() => {
          if (cancelled) return;
          setSuggestions([]);
          setStatus('empty');
        });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const choose = (suggestion: VenueSuggestion) => {
    onName(suggestion.name);
    if (suggestion.address) onAddress(suggestion.address);
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className={open ? 'relative z-40' : 'relative'}>
        <label className={labelClass} htmlFor={`${listId}-name`}>
          <span className="flex items-baseline justify-between gap-2">
            Venue name
            {nameRequired ? <span className="text-xs font-semibold uppercase tracking-wide text-amber-800">Required</span> : null}
          </span>
          <input
            id={`${listId}-name`}
            className={`${fieldClass} mt-1 font-normal`}
            value={name}
            autoComplete="off"
            role="combobox"
            aria-expanded={open && visible.length > 0}
            aria-controls={listId}
            onChange={(event) => {
              const next = event.target.value;
              onName(next);
              setOpen(true);
              setStatus(next.trim().length >= 3 ? 'searching' : 'idle');
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setOpen(false), 150);
            }}
          />
        </label>
        {query.length >= 3 && status === 'searching' ? (
          <p className="mt-1 text-xs font-normal text-gray-600">Searching…</p>
        ) : null}
        {query.length >= 3 && status === 'empty' ? (
          <p className="mt-1 text-xs font-normal text-gray-600">No matches, type the address</p>
        ) : null}
        {open && visible.length > 0 ? (
          <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-300 bg-white shadow-lg">
            {visible.map((suggestion) => (
              <li key={`${suggestion.name}|${suggestion.address}`}>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left hover:bg-[#f4eddc]"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(suggestion)}
                >
                  <span className="block text-sm font-semibold text-gray-900">{suggestion.name}</span>
                  {suggestion.address ? <span className="block text-sm font-normal text-gray-700">{suggestion.address}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <label className={labelClass}>
        <span className="flex items-baseline justify-between gap-2">
          Venue address
          {addressRequired ? <span className="text-xs font-semibold uppercase tracking-wide text-amber-800">Required</span> : null}
        </span>
        <input className={`${fieldClass} mt-1 font-normal`} value={address} onChange={(event) => onAddress(event.target.value)} autoComplete="street-address" />
      </label>
    </div>
  );
}
