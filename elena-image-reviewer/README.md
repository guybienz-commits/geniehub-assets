# Elena – Bildprüferin (CarGenie)

Elena prüft hochgeladene Fahrzeugfotos, **bevor** sie ins Inserat und in die
KI-Studio-Sequenz gelangen. Oberstes Prinzip: Ehrlichkeit im Interesse von
Käufer *und* Verkäufer — sichtbare Mängel werden benannt, nie wegretuschiert
(OR-Gewährleistung), und jede Ablehnung kommt mit einem konkreten,
umsetzbaren Rat.

## Vier Checks pro Bild

| Check | Frage | Ergebnisfeld |
|---|---|---|
| Qualität | Scharf, hell, ganzes Fahrzeug im Bild? | `qualitaet` (Score 0–100 + Rat) |
| Echtheit | Eigenes Foto oder Stockfoto/KI/Fremdinserat? | `echtheit` |
| Inhalt | Kennzeichen, Personen, Dokumente sichtbar? | `inhalt` (Massnahme: verpixeln / neu aufnehmen) |
| Konsistenz | Passt das Bild zu Modell und Farbe in `<fahrzeug>`? | `konsistenz` |

Zusätzlich dokumentiert `zustand` sichtbare Mängel ehrlich fürs Inserat.
Gesamtresultat: `geprueft` | `nachbessern` | `abgelehnt` — sichtbare Mängel
am Fahrzeug sind **kein** Ablehnungsgrund, sie gehören benannt ins Inserat.

## Aufbau

```
elena-image-reviewer/
├── prompt/
│   ├── system.de.md          ← System-Prompt mit {{FEWSHOT}}-Platzhalter
│   └── fewshot.seed.json     ← Start-Lernbeispiele (bis echte Daten da sind)
├── src/
│   ├── types.ts              ← ElenaReview-Typen + strikte JSON-Validierung
│   ├── prompt.ts             ← Prompt-Builder, rendert {{FEWSHOT}}
│   ├── review.ts             ← reviewVehicleImage() via Anthropic SDK
│   └── lernschleife.ts       ← Few-Shot-Pflege über Supabase
└── supabase/
    └── 20260724_elena_reviews.sql
```

## Verwendung

```typescript
import { createClient } from '@supabase/supabase-js';
import {
  reviewVehicleImage, saveReview, loadAktiveFewshot,
} from '@geniehub/elena-image-reviewer';

const supabase = createClient(url, serviceRoleKey);
const fewshot = await loadAktiveFewshot(supabase); // Fallback: Seed-Beispiele

const { review, model } = await reviewVehicleImage({
  imageBase64,
  mediaType: 'image/jpeg',
  fahrzeug: { marke: 'VW', modell: 'Golf 7', jahr: 2016, farbe: 'silber' },
  fewshot,
});

await saveReview(supabase, {
  inseratId, userId, bildUrl, fahrzeug, ergebnis: review, modell: model,
});
```

Antworten werden gegen das Schema validiert; bei ungültigem JSON wird genau
einmal mit Fehler-Feedback nachgefragt (`ElenaParseError` danach).

## Lernschleife ({{FEWSHOT}})

Der Platzhalter `{{FEWSHOT}}` in `system.de.md` wird nicht von Hand gepflegt,
sondern von der Lernschleife:

1. **`saveReview()`** — jedes Modell-Urteil landet in `elena_reviews`
   (Status `offen`).
2. **`submitKorrektur()`** — ein Moderator bestätigt das Urteil oder
   überstimmt es mit einer Korrektur; dazu gehört immer eine
   `bildbeschreibung`, die im Prompt später das Bild vertritt.
3. **`refreshFewshot()`** — baut das aktive Set in `elena_fewshot_beispiele`
   neu: korrigierte Fälle zuerst (aus Fehlern lernt das Modell am meisten),
   mindestens ein Beispiel pro Gesamt-Ausgang, max. 6 Beispiele. Ab drei
   echten Beispielen werden die Seeds deaktiviert.
4. **`loadAktiveFewshot()`** — wird beim Review geladen und als
   `{{FEWSHOT}}` in den System-Prompt injiziert.

`refreshFewshot()` läuft idealerweise als Cron (z. B. täglich) oder direkt
nach jeder Moderator-Korrektur.

## Konfiguration

| Variable | Zweck | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic SDK | – |
| `ELENA_MODEL` | Modell-Override | `claude-opus-4-6` |

Migration einspielen: `supabase/20260724_elena_reviews.sql` (Schreibzugriff
auf beide Tabellen nur via Service-Role; Nutzer lesen nur eigene Reviews).
