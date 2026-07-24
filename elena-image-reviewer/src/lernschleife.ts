import type { SupabaseClient } from '@supabase/supabase-js';
import type { ElenaReview, Fahrzeug, FewshotBeispiel, Gesamt } from './types';

/**
 * Lernschleife (learning loop) for Elena's few-shot examples.
 *
 * Flow:
 *  1. saveReview()       — every model verdict is persisted to elena_reviews.
 *  2. submitKorrektur()  — a moderator confirms or corrects a verdict.
 *  3. refreshFewshot()   — rebuilds the active few-shot set in
 *                          elena_fewshot_beispiele: corrected cases first
 *                          (the model learns most from its mistakes), with
 *                          coverage of all three "gesamt" outcomes.
 *  4. loadAktiveFewshot()— fetched at review time and injected as {{FEWSHOT}}.
 *
 * All writes go through the service role (RLS has no public write policies).
 */

const MAX_FEWSHOT = 6;
const GESAMT_WERTE: Gesamt[] = ['geprueft', 'nachbessern', 'abgelehnt'];

export interface GespeichertesReview {
  id: string;
  fahrzeug: Fahrzeug;
  bildbeschreibung: string | null;
  ergebnis: ElenaReview;
  korrektur: ElenaReview | null;
  status: 'offen' | 'bestaetigt' | 'korrigiert';
}

export async function saveReview(
  supabase: SupabaseClient,
  input: {
    inseratId?: string;
    userId?: string;
    bildUrl: string;
    fahrzeug: Fahrzeug;
    ergebnis: ElenaReview;
    modell: string;
  },
): Promise<string> {
  const { data, error } = await supabase
    .from('elena_reviews')
    .insert({
      inserat_id: input.inseratId ?? null,
      user_id: input.userId ?? null,
      bild_url: input.bildUrl,
      fahrzeug: input.fahrzeug,
      ergebnis: input.ergebnis,
      modell: input.modell,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

/**
 * Moderator feedback: pass a korrektur to overrule Elena, or none to confirm.
 * bildbeschreibung is required for corrections — it is what future prompts
 * show in place of the image.
 */
export async function submitKorrektur(
  supabase: SupabaseClient,
  reviewId: string,
  feedback: { korrektur?: ElenaReview; bildbeschreibung: string },
): Promise<void> {
  const { error } = await supabase
    .from('elena_reviews')
    .update({
      status: feedback.korrektur ? 'korrigiert' : 'bestaetigt',
      korrektur: feedback.korrektur ?? null,
      bildbeschreibung: feedback.bildbeschreibung,
    })
    .eq('id', reviewId);

  if (error) throw error;
}

/**
 * Rebuilds the active few-shot set. Selection strategy:
 * newest corrected reviews first, then confirmed ones, keeping at least one
 * example per "gesamt" outcome when available, capped at MAX_FEWSHOT.
 */
export async function refreshFewshot(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from('elena_reviews')
    .select('id, fahrzeug, bildbeschreibung, ergebnis, korrektur, status')
    .in('status', ['korrigiert', 'bestaetigt'])
    .not('bildbeschreibung', 'is', null)
    .order('status', { ascending: false }) // 'korrigiert' > 'bestaetigt'
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  const kandidaten = (data ?? []) as GespeichertesReview[];
  const gewaehlt: GespeichertesReview[] = [];

  // First pass: one example per outcome so every branch stays represented.
  for (const wert of GESAMT_WERTE) {
    const treffer = kandidaten.find(
      (k) => finalErgebnis(k).gesamt === wert && !gewaehlt.includes(k),
    );
    if (treffer) gewaehlt.push(treffer);
  }
  // Second pass: fill remaining slots in priority order.
  for (const k of kandidaten) {
    if (gewaehlt.length >= MAX_FEWSHOT) break;
    if (!gewaehlt.includes(k)) gewaehlt.push(k);
  }

  const rows = gewaehlt.map((k, idx) => ({
    review_id: k.id,
    fahrzeug: k.fahrzeug,
    bildbeschreibung: k.bildbeschreibung,
    ergebnis: finalErgebnis(k),
    quelle: k.status,
    sortierung: idx + 1,
    aktiv: true,
  }));

  const { error: deactivateError } = await supabase
    .from('elena_fewshot_beispiele')
    .update({ aktiv: false })
    .eq('aktiv', true)
    .neq('quelle', 'seed'); // seeds stay active until real data replaces them below

  if (deactivateError) throw deactivateError;

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from('elena_fewshot_beispiele').insert(rows);
    if (insertError) throw insertError;

    // Enough real examples → retire the seeds.
    if (rows.length >= 3) {
      const { error: seedError } = await supabase
        .from('elena_fewshot_beispiele')
        .update({ aktiv: false })
        .eq('quelle', 'seed');
      if (seedError) throw seedError;
    }
  }

  return rows.length;
}

export async function loadAktiveFewshot(supabase: SupabaseClient): Promise<FewshotBeispiel[]> {
  const { data, error } = await supabase
    .from('elena_fewshot_beispiele')
    .select('quelle, sortierung, fahrzeug, bildbeschreibung, ergebnis')
    .eq('aktiv', true)
    .order('sortierung', { ascending: true });

  if (error) throw error;
  return (data ?? []) as FewshotBeispiel[];
}

/** A correction, when present, is the ground truth — never the model output. */
function finalErgebnis(k: GespeichertesReview): ElenaReview {
  return k.korrektur ?? k.ergebnis;
}
