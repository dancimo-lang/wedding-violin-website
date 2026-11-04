'use client';

import { useEffect, useState } from 'react';
import { AdminButton } from '@/components/admin/AdminButton';
import { emptyCustomSongs, type CustomSongs } from '@/lib/contracts/custom-songs';
import { loadCustomSongs, saveCustomSongs } from '@/lib/contracts/custom-songs-store';
import { fieldClass } from '@/lib/leads';
import { createClient } from '@/lib/supabase/client';

const labelClass = 'block text-sm font-semibold text-gray-900';

export function CustomSongsFields({
  leadId,
  bookingId,
  songs,
  onChange,
}: {
  leadId?: string | null;
  bookingId?: string | null;
  songs?: CustomSongs;
  onChange?: (songs: CustomSongs) => void;
}) {
  const [owned, setOwned] = useState<CustomSongs>(emptyCustomSongs);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const value = songs ?? owned;
  const setValue = onChange ?? setOwned;

  useEffect(() => {
    if (songs) return;
    let cancelled = false;
    loadCustomSongs(createClient(), { leadId, bookingId })
      .then((next) => {
        if (!cancelled) setOwned(next);
      })
      .catch(() => {
        if (!cancelled) setOwned(emptyCustomSongs());
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId, leadId, songs]);

  const save = async () => {
    setSaving(true);
    setNotice('');
    const error = await saveCustomSongs(createClient(), { leadId, bookingId }, value).catch(() => 'Custom songs could not be saved.');
    setNotice(error || 'Custom songs saved. They are not part of the agreement.');
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm font-normal text-gray-700">
        Song title and artist. Optional, and not printed on the agreement. You can change these after the agreement is sent or signed.
      </p>
      <div className="grid gap-4">
        {value.map((song, index) => (
          <label key={index} className={labelClass}>
            Custom song {index + 1}
            <input
              className={`${fieldClass} mt-1 font-normal`}
              value={song}
              maxLength={160}
              onChange={(event) => {
                const next = [...value] as CustomSongs;
                next[index] = event.target.value;
                setValue(next);
              }}
            />
          </label>
        ))}
      </div>
      <AdminButton type="button" variant="secondary" disabled={saving || (!leadId && !bookingId)} onClick={() => void save()}>
        {saving ? 'Saving songs...' : 'Save songs'}
      </AdminButton>
      {!leadId && !bookingId ? <p className="text-sm text-gray-600">Songs can be saved once this record has a lead or booking.</p> : null}
      {notice ? <p className="text-sm text-gray-800">{notice}</p> : null}
    </div>
  );
}
