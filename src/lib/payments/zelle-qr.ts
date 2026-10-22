import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { zelleQrFromEnv, type ZelleEnv } from './zelle-config';

export function zelleQrFileExists(): boolean {
  try {
    return fs.existsSync(path.join(process.cwd(), 'public', 'images', 'zelle-qr.png'));
  } catch {
    return false;
  }
}

export function zelleQrSources(env?: ZelleEnv): { pageUrl: string | null; emailUrl: string | null } {
  return zelleQrFromEnv(zelleQrFileExists(), env);
}
