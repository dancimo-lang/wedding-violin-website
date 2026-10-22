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
