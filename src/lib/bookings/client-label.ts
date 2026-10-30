export type ClientInfo = {
  name: string | null;
  partner_name: string | null;
  email: string | null;
  phone?: string | null;
};

export function firstClient(value: ClientInfo | ClientInfo[] | null | undefined): ClientInfo | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

/** "Name & Partner", else email, else a short id. */
export function clientLabel(client: ClientInfo | null, clientId: string | null | undefined): string {
  const names = [client?.name, client?.partner_name]
    .map((value) => value?.trim())
    .filter(Boolean);
  if (names.length > 0) return names.join(' & ');
  if (client?.email?.trim()) return client.email.trim();
  return clientId ? clientId.slice(0, 8) : '-';
}
