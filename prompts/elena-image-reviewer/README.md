# Elena – Bildprüferin (CarGenie)

Versionierter System-Prompt für die Bildprüfung auf [cargenie.ch](https://cargenie.ch).
Elena prüft hochgeladene Fahrzeugfotos, **bevor** sie ins Inserat und in die
KI-Studio-Sequenz gelangen.

## Dateien

| Datei | Zweck |
|---|---|
| `system-prompt.md` | Prompt-Template mit `{{FEWSHOT}}`-Platzhalter. **Single Source of Truth** – Änderungen nur hier, nie im gerenderten Prompt. |
| `fewshot.json` | Lernbeispiele, die von der Lernschleife gepflegt werden. |
| `render-prompt.mjs` | Rendert Template + Beispiele zum finalen Prompt (`node render-prompt.mjs`). |

## Die vier Checks

1. **Qualität** – Schärfe, Licht, Bildausschnitt (Score 0–100).
2. **Echtheit** – Stockfoto, KI-generiert, Fremdinserat, unplausible EXIF.
3. **Inhalt** – Kennzeichen, Personen, Dokumente → Massnahme `verpixeln` / `neu_aufnehmen`.
4. **Konsistenz** – Passt das Bild zu Modell und Farbe aus `<fahrzeug>`?

**Grundprinzip:** Sichtbare Mängel am Fahrzeug (Kratzer, Dellen, Rost) sind
*kein* Ablehnungsgrund. Sie werden ehrlich im Feld `zustand` benannt und müssen
im Inserat sichtbar bleiben (OR-Gewährleistung). Elena schützt Verkäufer vor
späterer Haftung und Käufer vor Überraschungen – beides ist dasselbe Interesse.

Entscheidungslogik für `gesamt`:

- `abgelehnt` → nur bei `echtheit.ok=false` oder klar irreführendem Inhalt.
- `nachbessern` → Nutzer kann es selbst lösen; `rat` muss dann konkret und umsetzbar sein.
- `geprueft` → alle vier Checks ok.

## Lernschleife (`fewshot.json`)

Die Beispiele in `fewshot.json` werden aus realen Prüfungen gespeist, bei denen
Elena daneben lag und ein Mensch korrigiert hat (Quelle `korrektur`), plus den
kuratierten `seed`-Beispielen. Regeln:

- **Max. 8 Beispiele.** Kommt ein neues dazu, fliegt das älteste bzw. schwächste
  Nicht-Seed-Beispiel raus. Kurzer Prompt schlägt vollständigen Katalog.
- Jedes Beispiel braucht `fahrzeug`, `bildbeschreibung`, die vollständige
  `ausgabe` im Schema und eine einzeilige `lehre` (was der Fall lehrt).
- Beispiele decken bewusst unterschiedliche Fälle ab (verpixeln vs. ablehnen
  vs. nachbessern) – keine zwei Beispiele mit derselben Lehre.
- Manuelle Edits nur via PR-Review; die Lernschleife committet mit dem Präfix
  `fewshot:` und erhöht `version`.

## Integration (Next.js / Anthropic SDK)

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { renderPrompt } from '@/prompts/elena-image-reviewer/render-prompt.mjs';

const client = new Anthropic();

export async function reviewImage(imageBase64: string, fahrzeug: Fahrzeug) {
  const { prompt } = await renderPrompt();
  const msg = await client.messages.create({
    model: 'claude-sonnet-5', // Vision-Check pro Bild: Sonnet reicht, Kosten im Griff
    max_tokens: 1024,
    system: prompt,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
        { type: 'text', text: `<fahrzeug>${JSON.stringify(fahrzeug)}</fahrzeug>` },
      ],
    }],
  });
  return JSON.parse(msg.content[0].type === 'text' ? msg.content[0].text : '{}');
}
```

Ablauf im Produkt: Upload → `reviewImage()` → bei `gesamt: "geprueft"` Freigabe
für Inserat + KI-Studio-Sequenz, bei `nachbessern` wird `qualitaet.rat` bzw.
`inhalt.massnahme` dem Nutzer angezeigt, bei `abgelehnt` die
`echtheit.begruendung`.
