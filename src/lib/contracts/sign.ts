import { hashContractText } from './token';

export type ContractSignStatus = 'draft' | 'sent' | 'viewed' | 'signed' | 'void';

export type ContractSignState = {
  status: ContractSignStatus;
  signedText: string | null;
  contentSha256: string | null;
};

export type SignOnceResult =
  | { ok: true; status: 'signed'; signedText: string; contentSha256: string }
  | { ok: false; error: string; httpStatus: number; contentSha256: string | null };

/** A contract can be signed once. The stored hash stays the hash of that exact text. */
export function signOnce(state: ContractSignState, renderedText: string): SignOnceResult {
  if (state.status === 'signed') {
    return {
      ok: false,
      error: 'This agreement is already signed.',
      httpStatus: 409,
      contentSha256: state.contentSha256,
    };
  }
  if (state.status !== 'sent' && state.status !== 'viewed') {
    return {
      ok: false,
      error: 'This agreement is not open for signature.',
      httpStatus: 409,
      contentSha256: state.contentSha256,
    };
  }
  if (!renderedText.trim()) {
    return {
      ok: false,
      error: 'This agreement could not be prepared.',
      httpStatus: 500,
      contentSha256: null,
    };
  }
  return {
    ok: true,
    status: 'signed',
    signedText: renderedText,
    contentSha256: hashContractText(renderedText),
  };
}
