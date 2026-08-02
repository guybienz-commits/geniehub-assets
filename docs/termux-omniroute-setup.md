# Termux + OmniRoute Setup (Android)

Kurzanleitung, um auf einem Android-Gerät via Termux Node.js und
[OmniRoute](https://github.com/diegosouzapw/OmniRoute) (AI-Router / Proxy-CLI)
lauffähig zu bekommen.

## 1. Termux installieren — aus F-Droid, nicht aus dem Play Store

**Wichtig:** Die Play-Store-Version von Termux ist veraltet und wird nicht mehr
gepflegt. Sie ist an eine alte Android-API gebunden, `pkg`-Repositories werden
dafür nicht mehr aktualisiert, und Installationen schlagen mit
Signatur-/Repo-Fehlern fehl. Termux daher **immer** aus F-Droid oder direkt von
GitHub installieren:

- F-Droid App: <https://f-droid.org/> → dort nach `Termux` suchen
- Oder direkter APK-Download: <https://f-droid.org/packages/com.termux/>
- Oder GitHub Releases: <https://github.com/termux/termux-app/releases>

Falls bereits eine Play-Store-Version installiert ist: zuerst deinstallieren.
Die Signaturen unterscheiden sich, ein Update „drüber" ist nicht möglich.

Alle Termux-Zusatz-Apps (`termux-api`, `termux-styling`, …) müssen aus derselben
Quelle stammen wie die Haupt-App, sonst verweigert Android die Installation.

## 2. Paketquellen aktualisieren

```bash
pkg update && pkg upgrade -y
```

Beim ersten Lauf fragt Termux ggf. nach dem Überschreiben von Konfigurations-
dateien — die Vorgabe (`N`, bestehende Datei behalten) ist in Ordnung.

## 3. Node.js installieren

```bash
pkg install nodejs-lts -y
```

`nodejs-lts` statt `nodejs`, weil die LTS-Linie stabiler mit nativen Modulen
unter Termux zusammenspielt. Die beiden Pakete schliessen sich gegenseitig aus —
ist `nodejs` bereits installiert, vorher `pkg uninstall nodejs` ausführen.

Prüfen:

```bash
node -v && npm -v
```

OmniRoute benötigt Node >= 18.

## 4. OmniRoute installieren

```bash
npm install -g omniroute
```

## 5. Starten

```bash
omniroute
```

## Nützliche Ergänzungen

Zugriff auf den geräteinternen Speicher (Download-Ordner etc.) freischalten:

```bash
termux-setup-storage
```

Termux davon abhalten, den Prozess im Hintergrund zu beenden, während OmniRoute
läuft:

```bash
pkg install termux-services
```

…und in den Android-Einstellungen die Akku-Optimierung für Termux deaktivieren.

## Troubleshooting

| Problem | Ursache / Lösung |
| --- | --- |
| `pkg update` liefert 403 / „repository is under maintenance" | Play-Store-Version im Einsatz → aus F-Droid neu installieren. Alternativ `termux-change-repo` und einen anderen Mirror wählen. |
| `npm install -g` bricht mit `EACCES` ab | Nicht mit `sudo` arbeiten (gibt es unter Termux nicht). Prefix prüfen: `npm config get prefix` sollte auf `/data/data/com.termux/files/usr` zeigen. |
| `node: not found` nach der Installation | Termux-Session neu starten oder `hash -r` ausführen. |
| Build nativer Module schlägt fehl | `pkg install build-essential python` nachinstallieren. |
| Prozess stirbt, sobald der Bildschirm ausgeht | Wakelock in der Termux-Benachrichtigung aktivieren + Akku-Optimierung deaktivieren. |
