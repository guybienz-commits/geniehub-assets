#!/usr/bin/env node
/**
 * Renders the final Elena system prompt by injecting the few-shot
 * examples from fewshot.json into the {{FEWSHOT}} placeholder of
 * system-prompt.md.
 *
 * Usage:
 *   node render-prompt.mjs            # prints the rendered prompt to stdout
 *   node render-prompt.mjs --json     # prints { prompt, exampleCount }
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));

export function renderFewshot(fewshot) {
  if (!fewshot.beispiele?.length) return '(noch keine Lernbeispiele)';
  return fewshot.beispiele
    .map((b) => {
      const fahrzeug = JSON.stringify(b.fahrzeug);
      const ausgabe = JSON.stringify(b.ausgabe, null, 2);
      return [
        `<beispiel id="${b.id}">`,
        `<fahrzeug>${fahrzeug}</fahrzeug>`,
        `<bild>${b.bildbeschreibung}</bild>`,
        `<ausgabe>\n${ausgabe}\n</ausgabe>`,
        `<lehre>${b.lehre}</lehre>`,
        `</beispiel>`,
      ].join('\n');
    })
    .join('\n\n');
}

export async function renderPrompt() {
  const [template, fewshotRaw] = await Promise.all([
    readFile(join(dir, 'system-prompt.md'), 'utf8'),
    readFile(join(dir, 'fewshot.json'), 'utf8'),
  ]);
  const fewshot = JSON.parse(fewshotRaw);
  if (!template.includes('{{FEWSHOT}}')) {
    throw new Error('system-prompt.md is missing the {{FEWSHOT}} placeholder');
  }
  return {
    prompt: template.replace('{{FEWSHOT}}', renderFewshot(fewshot)),
    exampleCount: fewshot.beispiele?.length ?? 0,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await renderPrompt();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result));
  } else {
    console.log(result.prompt);
  }
}
