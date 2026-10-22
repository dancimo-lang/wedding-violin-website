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
