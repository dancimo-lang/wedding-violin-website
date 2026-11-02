export type SignerInput = {
  client1Name: string;
  client2Name: string;
  agreed: boolean;
};

function legalNameProblem(value: string, label: string, required: boolean): string | null {
  const name = value.trim();
  if (!name) return required ? `Enter the full legal name for ${label}.` : null;
  if (name.length > 200) return `${label}'s name is too long.`;
  if (/[\r\n{}]/.test(name)) return `Enter ${label}'s name on one line.`;
  if (!name.includes(' ') || name.length < 3) return `Enter the full legal name for ${label}.`;
  return null;
}

export function validateTypedName(value: string): string | null {
  const name = value.trim();
  if (!name || name.length > 200 || name.length < 3 || !name.includes(' ') || /[\r\n{}]/.test(name)) {
    return 'Enter a full legal name.';
  }
  return null;
}

export function validateSignature(input: SignerInput): string | null {
  if (!input.agreed) return 'Check the box to agree to this agreement.';
  const first = legalNameProblem(input.client1Name, 'Client 1', true);
  if (first) return first;
  return legalNameProblem(input.client2Name, 'Client 2', false);
}

export type SigningDates = {
  client1Name: string;
  client2Name: string;
  client1SignedOn: string;
  client2SignedOn: string;
};

function isIsoDay(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Each signer enters their own signing date. It must be a real date and not later
 * than tomorrow or earlier than a year ago (relative to the business day), which
 * allows for a signer in another time zone. The server timestamp is kept separately.
 */
export function validateSigningDates(input: SigningDates, todayIso: string): string | null {
  const check = (value: string, label: string): string | null => {
    const day = value.trim();
    if (!day) return `Enter the date ${label} is signing.`;
    if (!isIsoDay(day)) return `Enter a valid signing date for ${label}.`;
    if (day > addDays(todayIso, 1) || day < addDays(todayIso, -365)) return `Enter today's date as the signing date for ${label}.`;
    return null;
  };
  const first = check(input.client1SignedOn, 'Client 1');
  if (first) return first;
  if (input.client2Name.trim()) return check(input.client2SignedOn, 'Client 2');
  if (input.client2SignedOn.trim()) return 'Enter the name for Client 2, or clear the Client 2 date.';
  return null;
}
