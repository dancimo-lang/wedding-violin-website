export const PACKAGE_IDS = ['A', 'B', 'C', 'D', 'FULL'] as const;

export type PackageId = (typeof PACKAGE_IDS)[number];

export type ContractTemplateId = 'wedding-music' | 'full-wedding';

export type PackageDefinition = {
  id: PackageId;
  templateId: ContractTemplateId;
  /** Title as it appears in the owner-approved agreement. */
  title: string;
  feeCents: number;
};

export const PACKAGES: Record<PackageId, PackageDefinition> = {
  A: {
    id: 'A',
    templateId: 'wedding-music',
    title: 'Package A: Solo Violin Ceremony',
    feeCents: 45000,
  },
  B: {
    id: 'B',
    templateId: 'wedding-music',
    title: 'Package B: Solo Violin Ceremony & Cocktail Hour',
    feeCents: 100000,
  },
  C: {
    id: 'C',
    templateId: 'wedding-music',
    title: 'Package C: Violin & Guitar Duo Ceremony',
    feeCents: 100000,
  },
  D: {
    id: 'D',
    templateId: 'wedding-music',
    title: 'Package D: Violin & Guitar Duo Ceremony & Cocktail Hour',
    feeCents: 150000,
  },
  FULL: {
    id: 'FULL',
    templateId: 'full-wedding',
    title: 'Full Wedding',
    feeCents: 300000,
  },
};

export function isPackageId(value: string): value is PackageId {
  return (PACKAGE_IDS as readonly string[]).includes(value);
}

export function packageDefinition(id: PackageId): PackageDefinition {
  return PACKAGES[id];
}

/** Packages B and D print cocktail-hour start and end on the agreement. */
export function packageIncludesCocktailHour(id: PackageId): boolean {
  return id === 'B' || id === 'D';
}

/**
 * Packages A and B state solo violin overtime only.
 * Packages C and D keep the owner-approved duo and DJ sentence.
 */
export const SOLO_VIOLIN_OVERTIME =
  'Additional performance time requested on the day of the event may be provided at the Musician\'s discretion, subject to availability, and will be billed at $200 per hour for solo violin, in half-hour increments ($100 per half hour).';

export const DUO_DJ_OVERTIME =
  'Additional performance time requested on the day of the event may be provided at the Musician\'s discretion, subject to availability, and will be billed as follows: Live Duo Performance, $300 per hour; DJ Services, $200 per hour. Partial hours will be rounded to the nearest half-hour.';

export function weddingMusicOvertimeClause(id: PackageId): string {
  return id === 'A' || id === 'B' ? SOLO_VIOLIN_OVERTIME : DUO_DJ_OVERTIME;
}

/**
 * Best match from the lead or booking text. The admin still chooses the package
 * before anything is sent.
 */
export function guessPackageId(hints: {
  packageInterest?: string | null;
  service?: string | null;
  quotedPrice?: number | null;
}): PackageId {
  const text = `${hints.packageInterest ?? ''} ${hints.service ?? ''}`.toLowerCase();
  // Public package ids from src/data/weddings.json, sent by the booking form's ?package= prefill.
  const publicIds: Record<string, PackageId> = {
    'ceremony-solo': 'A',
    'ceremony-solo-cocktail': 'B',
    'ceremony-duo': 'C',
    'ceremony-cocktail': 'D',
    'full-wedding-dj': 'FULL',
  };
  const publicId = (hints.packageInterest ?? '').trim().toLowerCase();
  if (publicId in publicIds) return publicIds[publicId];
  if (
    /\bfull wedding\b|\bfull-wedding\b|\bpackage\s*full\b/.test(text) ||
    /\$?\s*3,?000\b/.test(text) ||
    hints.quotedPrice === 3000
  ) {
    return 'FULL';
  }
  if (/\bpackage\s*d\b/.test(text) || (/\bcocktail\b/.test(text) && /\b(duo|guitar)\b/.test(text))) {
    return 'D';
  }
  if (/\bpackage\s*b\b/.test(text) || (/\bcocktail\b/.test(text) && /\bsolo\b/.test(text))) {
    return 'B';
  }
  if (/\bpackage\s*c\b/.test(text) || /\b(duo|guitar)\b/.test(text)) return 'C';
  if (/\bpackage\s*a\b/.test(text) || /\bsolo\b/.test(text)) return 'A';
  if (hints.quotedPrice === 1500) return 'D';
  if (hints.quotedPrice === 1000) return 'C';
  if (hints.quotedPrice === 450) return 'A';
  return 'A';
}
