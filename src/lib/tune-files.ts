export const TUNE_FILE_MAX_BYTES = 20 * 1024 * 1024;
export const PRACTICE_TIPS_MAX = 2000;

const SCORE_EXTENSIONS = new Set(['.mscz', '.mxl', '.musicxml']);

export function fileExtension(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot).toLowerCase();
}

/** Extension from a public path or an http(s) URL, ignoring any query string. */
export function downloadExtension(value: string): string {
  try {
    const pathname = /^https?:\/\//i.test(value) ? new URL(value).pathname : value.split('?')[0] ?? '';
    return fileExtension(pathname);
  } catch {
    return '';
  }
}

export function isScoreExtension(extension: string): boolean {
  return SCORE_EXTENSIONS.has(extension);
}

export function isTuneId(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 80;
}

function sizeError(file: { size: number }, label: string): string | null {
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > TUNE_FILE_MAX_BYTES) {
    return `${label} must be 20 MB or smaller.`;
  }
  return null;
}

export function validateSheetMusicFile(file: { name: string; size: number }): string | null {
  if (fileExtension(file.name) !== '.pdf') return 'Sheet music must be a PDF.';
  return sizeError(file, 'Sheet music PDF');
}

export function validateScoreFile(file: { name: string; size: number }): string | null {
  if (!isScoreExtension(fileExtension(file.name))) {
    return 'MuseScore files must end in .mscz, .mxl, or .musicxml.';
  }
  return sizeError(file, 'MuseScore file');
}

export function cleanPracticeTips(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
}

export function practiceTipsError(value: string): string | null {
  if (value.length > PRACTICE_TIPS_MAX) return 'Practice tips must be 2000 characters or fewer.';
  return null;
}
