import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Fahrzeug, FewshotBeispiel } from './types';

const PROMPT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'prompt');

/** Renders the few-shot examples that replace {{FEWSHOT}} in the system prompt. */
export function renderFewshot(beispiele: FewshotBeispiel[]): string {
  if (beispiele.length === 0) return '(noch keine Lernbeispiele vorhanden)';

  return [...beispiele]
    .sort((a, b) => a.sortierung - b.sortierung)
    .map(
      (b) =>
        `<beispiel>\n<fahrzeug>${JSON.stringify(b.fahrzeug)}</fahrzeug>\n` +
        `<bild>${b.bildbeschreibung}</bild>\n` +
        `${JSON.stringify(b.ergebnis)}\n</beispiel>`,
    )
    .join('\n');
}

/** Loads system.de.md and injects the given few-shot examples. */
export async function buildSystemPrompt(beispiele: FewshotBeispiel[]): Promise<string> {
  const template = await readFile(join(PROMPT_DIR, 'system.de.md'), 'utf8');
  return template.replace('{{FEWSHOT}}', renderFewshot(beispiele));
}

/** Loads the shipped seed examples (used until the Lernschleife has real data). */
export async function loadSeedFewshot(): Promise<FewshotBeispiel[]> {
  const raw = await readFile(join(PROMPT_DIR, 'fewshot.seed.json'), 'utf8');
  return JSON.parse(raw) as FewshotBeispiel[];
}

/** Builds the user turn: the image plus the vehicle data Elena checks against. */
export function buildUserContent(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
  fahrzeug: Fahrzeug,
) {
  return [
    {
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: mediaType, data: imageBase64 },
    },
    {
      type: 'text' as const,
      text: `<fahrzeug>${JSON.stringify(fahrzeug)}</fahrzeug>`,
    },
  ];
}
