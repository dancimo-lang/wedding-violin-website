export type DeleteLeadResult = { ok: true } | { ok: false; error: string };

export async function deleteLead(leadId: string): Promise<DeleteLeadResult> {
  try {
    const response = await fetch(`/api/admin/leads/${leadId}`, { method: 'DELETE' });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      return { ok: false, error: payload.error || 'Could not delete that inquiry.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not delete that inquiry.' };
  }
}
