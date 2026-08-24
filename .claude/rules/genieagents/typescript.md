# TypeScript-Stil (GenieHub)

- Exportierte Funktionen, Shared Models und Component-Props explizit typisieren; lokale Variablen inferieren lassen.
- Kein `any` im App-Code — `unknown` für externe Inputs, dann sicher narrowen (`instanceof Error`); Generics statt Typ-Löcher.
- `interface` für erweiterbare Objekt-Shapes, `type` für Unions/Intersections; String-Literal-Unions statt `enum`.
- Immutabilität: neue Objekte per Spread statt Mutation; `Readonly<T>` für Funktionsparameter, wo sinnvoll.
- Fehler mit `try/catch` um `await`, `error: unknown` narrowen, serverseitig mit Kontext loggen — nie still schlucken.
- Kein `console.log` in Produktionscode; Logger verwenden.
- API-Antworten im Envelope `{ success, data?, error?, meta? }`; Pagination-Metadaten (total, page, limit) mitgeben.
- Dateien 200–400 Zeilen (max. 800), Funktionen <50 Zeilen, Verschachtelung <4 Ebenen — Early Returns bevorzugen.
