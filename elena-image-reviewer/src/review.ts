import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt, buildUserContent, loadSeedFewshot } from './prompt';
import { ElenaParseError, parseReview } from './types';
import type { ElenaReview, Fahrzeug, FewshotBeispiel } from './types';

const DEFAULT_MODEL = process.env.ELENA_MODEL ?? 'claude-opus-4-6';

export interface ReviewInput {
  imageBase64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  fahrzeug: Fahrzeug;
  /** Active few-shot set from the Lernschleife; falls back to the seed examples. */
  fewshot?: FewshotBeispiel[];
  model?: string;
}

export interface ReviewOutput {
  review: ElenaReview;
  model: string;
  /** Raw model text, kept for the Lernschleife audit trail. */
  raw: string;
}

/**
 * Runs one Elena image review: image + <fahrzeug> data in, validated JSON out.
 * Retries once with the parse error fed back if the first answer is malformed.
 */
export async function reviewVehicleImage(input: ReviewInput): Promise<ReviewOutput> {
  const client = new Anthropic();
  const model = input.model ?? DEFAULT_MODEL;
  const fewshot = input.fewshot ?? (await loadSeedFewshot());
  const system = await buildSystemPrompt(fewshot);
  const userContent = buildUserContent(input.imageBase64, input.mediaType, input.fahrzeug);

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userContent }];

  for (let attempt = 0; ; attempt++) {
    const msg = await client.messages.create({ model, max_tokens: 1024, system, messages });
    const raw = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    try {
      return { review: parseReview(raw), model, raw };
    } catch (err) {
      if (!(err instanceof ElenaParseError)) throw err;
      if (attempt >= 1) throw err;
      messages.push(
        { role: 'assistant', content: raw },
        {
          role: 'user',
          content:
            `Deine Antwort war kein gültiges JSON gemäss Schema (${err.message}). ` +
            'Gib jetzt AUSSCHLIESSLICH das korrigierte JSON zurück.',
        },
      );
    }
  }
}
