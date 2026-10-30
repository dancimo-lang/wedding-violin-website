'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { LeadFields } from '@/components/admin/LeadFields';
import { postBookingStatus } from '@/lib/booking-status-client';
import { emptyLeadDraft, leadWritePayload, type LeadDraft } from '@/lib/leads';
import { createClient } from '@/lib/supabase/client';

function supabase() {
  return createClient();
}

export default function NewLeadPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<LeadDraft>(emptyLeadDraft());
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = leadWritePayload(draft);
    if (!payload.ok) {
      setError(payload.error);
      return;
    }
    setSaving(true);
    setError('');

    let clientId: string | null = null;
    if (payload.client.email) {
      const { data: existing, error: lookupError } = await supabase()
        .from('clients')
        .select('id')
        .eq('email', payload.client.email)
        .maybeSingle();
      if (lookupError) {
        setError('Could not look up that email.');
        setSaving(false);
        return;
      }
      clientId = existing?.id || null;
    }

    if (!clientId) {
      const { data: created, error: clientError } = await supabase()
        .from('clients')
        .insert(payload.client)
        .select('id')
        .single();
      if (clientError || !created) {
        setError('Could not save the client.');
        setSaving(false);
        return;
      }
      clientId = created.id;
    } else {
      const { error: updateError } = await supabase().from('clients').update(payload.client).eq('id', clientId);
      if (updateError) {
        setError('Could not update the client.');
        setSaving(false);
        return;
      }
    }

    const booked = payload.lead.status === 'Confirmed' || payload.lead.status === 'Completed';
    const { data: lead, error: leadError } = await supabase()
      .from('leads')
      .insert({
        ...payload.lead,
        status: booked ? 'Awaiting Response' : payload.lead.status,
        client_id: clientId,
        inquiry_details: {
          source: payload.lead.inquiry_source,
          name: payload.client.name,
          email: payload.client.email,
          phone: payload.client.phone,
          partner: payload.client.partner_name,
          services: payload.lead.requested_services,
          eventDate: payload.lead.event_date,
          message: payload.lead.message,
        },
      })
      .select('id')
      .single();

    if (leadError || !lead) {
      setError('Could not save the lead.');
      setSaving(false);
      return;
    }

    await supabase().from('activity_events').insert({
      lead_id: lead.id,
      event_type: 'inquiry',
      title: `Lead added by ${payload.lead.inquiry_source || 'hand'}`,
      body: payload.lead.message,
      metadata: { source: payload.lead.inquiry_source },
    });

    if (booked) {
      const result = await postBookingStatus({
        action: 'set_lead_status',
        leadId: lead.id,
        status: payload.lead.status,
        fields: {
          client_id: clientId,
          lead_id: lead.id,
          event_date: payload.lead.event_date,
          venue_name: payload.lead.venue_name,
          venue_address: payload.lead.venue_address,
          service_type: payload.lead.service_type || payload.lead.requested_services || 'Performance',
          performance_start_time: payload.lead.performance_start_time,
          performance_end_time: payload.lead.performance_end_time,
          performers_needed: payload.lead.performers_needed,
          total_price: payload.lead.quoted_price ?? 0,
          special_requests: payload.lead.message,
        },
      });
      if (!result.ok) {
        setSavedId(lead.id);
        setError(`${result.error} The lead was saved without that booking.`);
        setSaving(false);
        return;
      }
    }

    router.push(`/admin/leads/${lead.id}`);
  };

  return (
    <form onSubmit={save}>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/admin/leads" className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></Link>
          <h2 className="text-3xl font-bold text-gray-900">New lead</h2>
        </div>
        <button type="submit" disabled={saving || Boolean(savedId)} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg">
          {saving ? 'Saving...' : 'Save lead'}
        </button>
      </div>
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}{' '}
          {savedId && <Link href={`/admin/leads/${savedId}`} className="underline">Open the lead</Link>}
        </div>
      )}
      <div className="bg-white rounded-xl shadow p-6">
        <LeadFields draft={draft} onChange={setDraft} />
      </div>
    </form>
  );
}
