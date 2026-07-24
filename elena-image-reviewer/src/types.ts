export type Perspektive =
  | 'front'
  | 'heck'
  | 'seite_links'
  | 'seite_rechts'
  | 'innenraum'
  | 'detail'
  | 'unklar';

export type Gesamt = 'geprueft' | 'nachbessern' | 'abgelehnt';

export type Verdacht =
  | 'stockfoto'
  | 'ki_generiert'
  | 'fremdinserat'
  | 'exif_unplausibel';

export type Massnahme = 'verpixeln' | 'neu_aufnehmen' | 'keine';

export interface ElenaReview {
  qualitaet: {
    ok: boolean;
    score: number;
    maengel: string[];
    rat: string;
  };
  echtheit: {
    ok: boolean;
    verdacht: Verdacht[];
    begruendung: string;
  };
  inhalt: {
    ok: boolean;
    kennzeichen_sichtbar: boolean;
    personen_sichtbar: boolean;
    dokumente_sichtbar: boolean;
    massnahme: Massnahme;
  };
  konsistenz: {
    ok: boolean;
    modell_passt: boolean;
    farbe_passt: boolean;
    abweichung: string | null;
  };
  zustand: {
    sichtbare_maengel: string[];
    hinweis_inserat: string;
  };
  gesamt: Gesamt;
  perspektive: Perspektive;
}

export interface Fahrzeug {
  marke: string;
  modell: string;
  jahr?: number;
  farbe?: string;
  kilometerstand?: number;
  [key: string]: unknown;
}

export interface FewshotBeispiel {
  quelle: 'seed' | 'korrigiert' | 'bestaetigt';
  sortierung: number;
  fahrzeug: Fahrzeug;
  bildbeschreibung: string;
  ergebnis: ElenaReview;
}

const PERSPEKTIVEN: Perspektive[] = [
  'front', 'heck', 'seite_links', 'seite_rechts', 'innenraum', 'detail', 'unklar',
];
const GESAMT: Gesamt[] = ['geprueft', 'nachbessern', 'abgelehnt'];
const VERDACHT: Verdacht[] = ['stockfoto', 'ki_generiert', 'fremdinserat', 'exif_unplausibel'];
const MASSNAHMEN: Massnahme[] = ['verpixeln', 'neu_aufnehmen', 'keine'];

export class ElenaParseError extends Error {
  constructor(message: string, public readonly raw: string) {
    super(message);
    this.name = 'ElenaParseError';
  }
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === 'string');
}

/**
 * Parses and validates Elena's raw model output into an ElenaReview.
 * Throws ElenaParseError on any structural violation so the caller can retry.
 */
export function parseReview(raw: string): ElenaReview {
  // Tolerate accidental code fences even though the prompt forbids them.
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

  let data: any;
  try {
    data = JSON.parse(cleaned);
  } catch (e) {
    throw new ElenaParseError(`Antwort ist kein gültiges JSON: ${(e as Error).message}`, raw);
  }

  const fail = (feld: string): never => {
    throw new ElenaParseError(`Feld "${feld}" fehlt oder ist ungültig`, raw);
  };

  const q = data?.qualitaet;
  if (
    !q || typeof q.ok !== 'boolean' ||
    typeof q.score !== 'number' || q.score < 0 || q.score > 100 ||
    !isStringArray(q.maengel) || typeof q.rat !== 'string'
  ) fail('qualitaet');

  const e = data?.echtheit;
  if (
    !e || typeof e.ok !== 'boolean' || typeof e.begruendung !== 'string' ||
    !Array.isArray(e.verdacht) || !e.verdacht.every((v: unknown) => VERDACHT.includes(v as Verdacht))
  ) fail('echtheit');

  const i = data?.inhalt;
  if (
    !i || typeof i.ok !== 'boolean' ||
    typeof i.kennzeichen_sichtbar !== 'boolean' ||
    typeof i.personen_sichtbar !== 'boolean' ||
    typeof i.dokumente_sichtbar !== 'boolean' ||
    !MASSNAHMEN.includes(i.massnahme)
  ) fail('inhalt');

  const k = data?.konsistenz;
  if (
    !k || typeof k.ok !== 'boolean' ||
    typeof k.modell_passt !== 'boolean' || typeof k.farbe_passt !== 'boolean' ||
    !(k.abweichung === null || typeof k.abweichung === 'string')
  ) fail('konsistenz');

  const z = data?.zustand;
  if (!z || !isStringArray(z.sichtbare_maengel) || typeof z.hinweis_inserat !== 'string') {
    fail('zustand');
  }

  if (!GESAMT.includes(data.gesamt)) fail('gesamt');
  if (!PERSPEKTIVEN.includes(data.perspektive)) fail('perspektive');

  return data as ElenaReview;
}
