import type { GoogleStatusView } from '@/lib/google/status';

export function GoogleConnectionCard({
  view,
  notice,
  pending,
  onDisconnect,
  onSync,
}: {
  view: GoogleStatusView;
  notice: string;
  pending: boolean;
  onDisconnect: () => void;
  onSync: () => void;
}) {
  const checked = view.busySyncedAt
    ? new Date(view.busySyncedAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
    : null;

  return (
    <section className="max-w-xl bg-white rounded-xl shadow p-6 space-y-4 mt-6">
      <h2 className="text-2xl font-bold text-gray-900">Google Calendar</h2>
      <p className="text-sm text-gray-600">
        Connect the Google account where your own appointments live. Confirmed bookings, tentative holds, and manual blocks are copied to a calendar named Weddings (website). A busy time on your main Google calendar blocks only that start-to-end window. Notes you type on a block stay on this website.
      </p>
      {!view.configured && (
        <p className="text-sm text-amber-900">
          Google Calendar keys are not set on the server yet. Add them, then come back and click Connect.
        </p>
      )}
      {view.needsReconnect && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Reconnect Google</p>
          <p className="mt-1">The saved connection stopped working. Connect again to keep bookings and busy times in step.</p>
        </div>
      )}
      {view.connected && (
        <div className="text-sm text-gray-800 space-y-1">
          <p>Connected{view.email ? ` as ${view.email}` : ''}.</p>
          <p>
            Calendar: {view.calendarSummary || 'Weddings (website)'}
            {view.calendarMode === 'primary' ? ' (using your primary calendar)' : ''}.
          </p>
          <p>{checked ? `Busy times last read ${checked} PT.` : 'Busy times have not been read yet.'}</p>
          {!view.busyFresh && (
            <p className="text-amber-900">
              Those busy times are more than two hours old, so the public date check will ask you to confirm a date instead of saying it appears available.
            </p>
          )}
        </div>
      )}
      {!view.connected && view.configured && !view.needsReconnect && (
        <p className="text-sm text-gray-700">Google Calendar is not connected.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {view.configured && (!view.connected || view.needsReconnect) && (
          <a href="/api/admin/google/connect" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
            {view.needsReconnect ? 'Reconnect Google' : 'Connect Google Calendar'}
          </a>
        )}
        {view.connected && (
          <>
            <button
              type="button"
              onClick={onSync}
              disabled={pending}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-800 disabled:text-gray-400"
            >
              {pending ? 'Syncing...' : 'Sync now'}
            </button>
            <button
              type="button"
              onClick={onDisconnect}
              disabled={pending}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-800 disabled:text-gray-400"
            >
              Disconnect
            </button>
          </>
        )}
      </div>
      {notice && <p className="text-sm text-gray-800">{notice}</p>}
    </section>
  );
}
