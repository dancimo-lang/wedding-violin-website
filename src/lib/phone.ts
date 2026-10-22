import site from '@/data/site.json';

/** Ten-digit NANP number taken from the display phone in site.json. */
function nationalDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits;
}

/** E.164 form of the display phone, e.g. +1 plus ten digits. */
export function phoneE164(phone: string = site.phone): string {
  return `+1${nationalDigits(phone)}`;
}

export function phoneTelHref(phone: string = site.phone): string {
  return `tel:${phoneE164(phone)}`;
}

export function phoneSmsHref(phone: string = site.phone): string {
  return `sms:${phoneE164(phone)}`;
}

/** Schema.org telephone, e.g. +1-XXX-XXX-XXXX. */
export function phoneSchemaTelephone(phone: string = site.phone): string {
  const digits = nationalDigits(phone);
  return `+1-${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}
