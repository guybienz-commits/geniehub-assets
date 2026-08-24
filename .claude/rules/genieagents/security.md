# Security (Next.js + Supabase)

- Keine Secrets im Code — nur `process.env`; Vorhandensein beim Start prüfen, exponierte Secrets sofort rotieren.
- `NEXT_PUBLIC_*` nur für wirklich öffentliche Werte; Service-Role-Key ausschließlich serverseitig (Route Handler, Server Action, Edge Function).
- Jede Tabelle bekommt RLS-Policies in derselben Migration; Auth-Checks gehören in den Server, nie nur ins UI.
- Eingaben an Systemgrenzen mit Zod validieren (`schema.parse`), Typen via `z.infer` ableiten; externe Daten nie ungeprüft verwenden.
- Fehlermeldungen an Clients generisch halten; Details (Stack, Query, Token) nur serverseitig loggen.
- Bei Security-Fund: stoppen, CRITICAL zuerst fixen, Codebase auf gleiche Muster durchsuchen.
