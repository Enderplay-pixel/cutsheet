# CutSheet Designphilosophie „Tungsten“

**Stand:** 28.09.2026
**Grundlage:** Messung der öffentlichen Designsysteme hinter den meistbesuchten Websites der Welt.
**Gilt für:** Web-App, Set-App (PWA/TWA), PDFs, Präsentationen.

> **Kurzfassung:** Fast alle großen Websites sehen gleich aus. Sie nutzen 14 px Grundschrift, ein 4-px-Raster, 8 px Radius, 200 ms Bewegung und eine blaue Akzentfarbe. Die ersten vier Werte übernehmen wir, weil sie gemessen funktionieren. Die blaue Akzentfarbe übernehmen wir nicht. CutSheet leuchtet in **Tungsten**, dem warmen Orange des Kunstlichts am Set (3200 K), auf warmen Negativ-Grautönen. Jede Handlung antwortet sofort und körperlich. Echte Fortschritte werden gefeiert, ohne Tricks, die Leute künstlich festhalten.

---

## 1. Methode

### 1.1 Welche Websites

Die „Top 100“ sind nach Besuchen pro Monat geordnet (Similarweb, Stand August 2026).

- **Ränge 1–10, einzeln belegt:** google.com, youtube.com, facebook.com, instagram.com, chatgpt.com, x.com, reddit.com, bing.com, tiktok.com, whatsapp.com. Wikipedia liegt knapp dahinter.
- **Belegte Einzelwerte:**
  - Google: 105,7 Mrd. Besuche pro Monat
  - YouTube: 54,9 Mrd.
  - Facebook: 10,7 Mrd.
  - Amazon: Rang 13, 2,5 Mrd.
  - Temu: Rang 26, 1,6 Mrd.
  - Discord: Rang 50
  - Walmart: unter den ersten 60
  - Etsy: Rang 62
- **Ränge 11–100:** Sie schwanken monatlich und sind nicht frei einzeln abrufbar. Anhang A führt sie deshalb **nach Kategorie** statt mit erfundenen Rangzahlen.
- **Am schnellsten wachsende Kategorie:** KI-Assistenten (ChatGPT, Gemini, Claude, Perplexity, DeepSeek).

### 1.2 Was gemessen wurde

Statt Screenshots zu schätzen, haben wir die **veröffentlichten Design-Token-Pakete** der Betreiber aus der npm-Registry geladen und ausgewertet.

- Custom Properties, JSON und JS wurden geparst.
- `var()`-Verweise wurden aufgelöst.
- `rem`-Werte wurden in px umgerechnet (16 px Basis).

| System | Version | Deckt ab |
|---|---|---|
| Material 3 (`@material/web`) | 2.5.0 | Google, YouTube, Gmail, Gemini |
| Fluent 2 (`@fluentui/tokens`, `react-theme`) | 1.0.0-α.24 / 9.2.2 | Bing, Microsoft 365, Outlook, MSN |
| Primer (`@primer/primitives`) | 11.10.0 | GitHub |
| Codex (`@wikimedia/codex-design-tokens`) | 2.6.0 | Wikipedia |
| Evo (`@ebay/skin`) | 19.36.0 | eBay |
| Gestalt (`gestalt-design-tokens`) | 177.0.12 | Pinterest |
| Polaris (`@shopify/polaris-tokens`) | 9.4.2 | Shopify |
| VKUI (`@vkontakte/vkui-tokens`) | 4.92.0 | VK |
| Gravity UI (`@gravity-ui/uikit`) | 7.50.1 | Yandex |
| Spectrum (`@adobe/spectrum-tokens`) | 15.4.1 | Adobe |
| Cloudscape (`@cloudscape-design/design-tokens`) | 3.0.113 | Amazon / AWS |
| Ant Design (`antd`) | 6.6.5 | Alibaba, AliExpress, Taobao |
| Atlassian (`@atlaskit/tokens`) | 20.1.0 | Jira, Trello, Confluence |
| TDesign (`tdesign-vue-next`) | 1.20.8 | Tencent, QQ, WeChat |
| GOV.UK Frontend | 6.5.1 | Referenz für Barrierefreiheit |
| Apple HIG | dokumentierte Werte | Apple, iCloud |

**Nicht messbar:**

- Meta (Facebook, Instagram, WhatsApp), TikTok, X und Reddit veröffentlichen keine Token-Pakete.
- Nicht jugendfreie Seiten, die in den Top 100 vorkommen, wurden nicht ausgewertet.
- Die gemessenen Systeme stehen trotzdem hinter dem Großteil des Verkehrs der Top 100, allein Google-Dienste machen mehr als die Hälfte der Besuche aus.

Ergänzt wird das durch den **HTTP Archive Web Almanac 2024**:

- 87 % aller Seiten laden Webfonts.
- WOFF2 hat 78 % Anteil auf Desktop.
- Rund 40 % der Seiten nutzen mindestens eine variable Schrift.
- Farben sind die häufigste Art von CSS-Custom-Property (30,6 %).

---

## 2. Befunde (Median und Spannweite über 16 Systeme)

| Größe | Median | Spannweite | Beobachtung |
|---|---|---|---|
| Grundschrift | **14 px** | 13–19 px | Werkzeuge 13–14, Lese-Seiten 16, Apple 17, GOV.UK 19 |
| Zeilenhöhe | **21 px** (×1,46) | 18–26 px | Lesen 1,5–1,6, dichte Tabellen 1,38–1,43 |
| Rasterbasis | **4 px** | 4–8 px | 14 von 16 Systemen auf 4 px (GOV.UK 5 px, eBay/Atlassian 8 px) |
| Radius (alle Stufen) | **8 px** | 2–28 px | Trend zu größeren Radien: Cloudscape 20, Gestalt 24, M3 28 |
| Steuerelement-Höhe | **32 px** | 28–48 px | Touch-first: VK 44, Apple 44, Pinterest 48 |
| Fokusring | **2 px** | 2–3 px | Material, GOV.UK und Apple 3 px; Abstand meist 2 px |
| Dauer | **200 ms** | P25 115 / P75 300 | fast nie über 500 ms; Material bis 1000 für große Flächen |
| Easing | ausklingend | – | stark bremsende Kurven: (0.2,0,0,1), (0.05,0.7,0.1,1), (0,0,0,1) |
| Textfarbe | fast schwarz | #000–#303030 | nie reines Grau; Kontrast 13–21:1 |
| Akzent-Farbton | **211°** | – | **12 von 16 blau** (208–227°) |

**Die vier Ausreißer beim Akzent** zeigen, dass eine eigene Farbe Wiedererkennung bringt:

- Pinterest: Rot #E60023
- Yandex: Gelb #FFBE5C
- Shopify: fast Schwarz #303030
- Material: Violett #6750A4

**Was daraus folgt:**

1. **Struktur ist gelöst.** Schriftgröße, Raster, Radius, Dauer und Fokusring haben sich über Konzerne und Kontinente auf fast dieselben Werte eingependelt. Davon abzuweichen kostet Lesbarkeit und bringt keine Eigenständigkeit.
2. **Farbe ist nicht gelöst, sondern verwechselbar.** Wer Blau nimmt, sieht aus wie Microsoft, GitHub, Wikipedia, eBay, Amazon, Alibaba, Atlassian, Tencent und Apple zusammen.
3. **Bewegung ist kurz und bremst stark.** Das „Premium-Gefühl“ entsteht durch Kurven mit schnellem Start und weichem Ankommen, nicht durch lange Dauern.
4. **Touch verlangt 44 px.** Alle mobil geprägten Systeme (VK, Apple, Pinterest) liegen bei 44–48 px. Die dichten Desktop-Systeme liegen bei 32 px.

---

## 3. Die Philosophie in acht Sätzen

1. **Das Werkzeug tritt zurück, die Produktion tritt vor.**
   - Die Oberfläche ist warmes Papier.
   - Farbe gibt es nur dort, wo gehandelt wird oder etwas Wichtiges passiert.
2. **Eine Handlungsfarbe: Tungsten.**
   - Alles, was man drücken kann und was primär ist, leuchtet orange, sonst nichts.
   - Blau ist zu „Daylight“ herabgestuft und steht nur noch für Hinweise.
3. **Warmes Neutral statt kaltem Grau.**
   - Alle gemessenen Systeme nutzen neutrale oder kühle Grautöne.
   - Unsere Grautöne haben einen Hauch Braun (Farbton 24–36°), wie ein Negativstreifen.
   - Das ist eigenständig, ohne laut zu sein.
4. **Dichte nach Einsatzort.**
   - Im Büro: 14 px Schrift und 36 px Steuerelemente (Median plus Luft).
   - Am Set, mit Handschuhen, in der Sonne und mit Zeitdruck: 17 px Schrift und 44 px Tippflächen.
5. **Alles liegt auf dem 4-px-Raster.** Abstände sind nur 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
6. **Bewegung ist Antwort, nicht Dekoration.**
   - Jede Eingabe bekommt innerhalb von 100 ms eine sichtbare Reaktion.
   - Wege dauern um 200 ms und bremsen stark.
   - Federn gibt es nur, wenn der Nutzer selbst etwas ausgelöst hat.
7. **Belohnung ohne Manipulation.**
   - Das Gefühl kommt aus echter erledigter Arbeit: Häkchen, gespeichert, Drehtag im Kasten.
   - Nie aus Punkten, Serien-Druck, Countdowns oder Benachrichtigungs-Ködern.
8. **Barrierefreiheit wird gemessen, nicht behauptet.**
   - Jeder Text hat mindestens 4,5:1 Kontrast.
   - Farbe trägt nie allein eine Bedeutung.
   - Der Fokus ist immer sichtbar.
   - „Bewegung reduzieren“ wird respektiert.

---

## 4. Farbschema „Tungsten“

### 4.1 Idee

Film wird mit zwei Lichtfarben gemacht:

- **Tungsten (3200 K):** warmes Kunstlicht.
- **Daylight (5600 K):** kühles Tageslicht.

CutSheet übernimmt diese Dualität:

- **Tungsten-Orange** ist die Marke und die einzige Handlungsfarbe.
- **Daylight-Blau** steht für Information.
- Die Flächen sind **Negativ-Grautöne**: leicht warm, nie klinisch.

Unter den 16 gemessenen Systemen nutzt keines Orange als Hauptakzent. Die Farbe ist also eigenständig, und sie gehört inhaltlich zur Branche: Klappe, Gaffa-Band, Kunstlicht.

### 4.2 Tokens hell

| Token | Hex | HSL (für `index.css`) | Kontrast |
|---|---|---|---|
| `background` | #F6F4F1 | 36 21.7% 95.5% | – |
| `card` | #FFFFFF | 0 0% 100% | – |
| `foreground` (Tinte) | #1C1917 | 24 9.8% 10% | 17,5:1 auf Karte |
| `muted-foreground` | #665E57 | 28 7.9% 37.1% | 6,4:1 auf Karte, 5,8:1 auf Grund |
| `border` | #E4DED7 | 32 19.4% 86.9% | dekorativ |
| **`primary` Tungsten 600** | **#C43D0B** | 16 89.4% 40.6% | 5,2:1 (Weiß darauf 5,2:1) |
| `info` Daylight | #1971C2 | 209 77.2% 42.9% | 5,0:1 |
| `success` | #237A36 | 133 55.4% 30.8% | 5,4:1 |
| `warning` | #8A6100 | 42 100% 27.1% | 5,5:1 |
| `danger` / `destructive` | #A61E4D | 339 69.4% 38.4% | 7,2:1 |

### 4.3 Tokens dunkel

| Token | Hex | HSL | Kontrast |
|---|---|---|---|
| `background` | #131110 | 20 8.6% 6.9% | – |
| `card` | #1D1A18 | 24 9.4% 10.4% | – |
| `foreground` | #F4F1EC | 37 26.7% 94.1% | 15,4:1 |
| `muted-foreground` | #A69D94 | 30 9.2% 61.6% | 6,5:1 |
| `border` | #34302C | 30 8.3% 18.8% | dekorativ |
| **`primary` Tungsten 400** | **#F2802E** | 24 88.3% 56.5% | 6,5:1 (Tinte darauf 7,0:1) |
| `info` | #6CB4F5 | 208 87.3% 69.2% | 7,8:1 |
| `success` | #5BCB7C | 138 51.9% 57.6% | 8,5:1 |
| `warning` | #F2C14E | 42 86.3% 62.7% | 10,3:1 |
| `danger` | #FF6FA3 | 338 100% 71.8% | 6,6:1 |

**Im Dunkelmodus kehrt sich die Schrift auf farbigen Flächen um.** Auf Tungsten 400 steht dunkle Tinte (#1C1008), kein Weiß, denn nur so bleiben die Knöpfe über 4,5:1.

### 4.4 Statusfarben und Farbenblindheit

„Danger“ ist bewusst **Karmin-Magenta (339°)** und kein Orange-Rot. Nur so lässt es sich von Tungsten (16°) unterscheiden.

Die fünf Statusfarben (Tungsten, Daylight, Grün, Gaffer-Gelb, Karmin) wurden mit einem Paletten-Prüfskript auf allen Paaren geprüft. Das Skript simuliert Farbenblindheit nach Machado 2009 und misst Abstände in OKLab:

- **Hell** (Grundfarben #D9480F, #1C7ED6, #2B8A3E, #E0A800, #A61E4D):
  - Helligkeitsband, Sättigung und Kontrast: bestanden.
  - Normalsicht-Mindestabstand ΔE 15,5: bestanden.
  - Rot-Grün-Schwäche: ΔE 7,9, im Warnband 6–8, also nur mit Zweitkodierung erlaubt.
- **Dunkel:**
  - Fünf Farbtöne erreichen in allen Paaren den Rot-Grün-Abstand nicht. Das haben wir mit 60 000 Zufallspaletten nachgerechnet.
  - Deshalb gilt ohne Ausnahme: **Status zeigt immer Symbol und Wort, nie nur Farbe.** Die App tut das bereits (Badges mit Text, Konfliktradar mit Symbolen).

### 4.5 Diagrammpaletten (Dashboards, Budget, Zeitanalyse)

Diese Paletten sind geprüft in fester Reihenfolge, benachbarte Paare, 8 Plätze.

| Modus | Reihenfolge | Ergebnis |
|---|---|---|
| hell (auf #FFFFFF) | #DB753C · #2568DE · #D1A72E · #9982D2 · #19BE4D · #EC4282 · #31B9CC · #D17270 | alle Prüfungen bestanden. Rot-Grün-Abstand 8,4, Normalsicht 24,2. Gelb, Grün und Türkis liegen unter 3:1, deshalb immer Direktbeschriftung |
| dunkel (auf #1D1A18) | #B9501A · #5687E6 · #A28017 · #834BB3 · #5A9452 · #AC3C7A · #18A0B8 · #D3544C | alle Prüfungen bestanden. Rot-Grün-Abstand 11,0, Normalsicht 27,2 |

**Regeln für Diagramme:**

- Die Reihenfolge ist fest. Die erste Kategorie ist immer Tungsten.
- Es gibt eine Achse und direkte Beschriftung statt Legende, wo möglich.
- Mehr als 8 Kategorien werden zu „Sonstige“ zusammengefasst.

### 4.6 Branchenfarben bleiben

Die Streifenfarben im Stäbchenplan und in der Shotlist (INT/EXT × Tag/Nacht) folgen Branchenkonvention und sind **keine** Markenfarben. Sie bleiben.

---

## 5. Typografie

**Schriftfamilie:**

- UI: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Geist Variable', system-ui, sans-serif`
- Titel: `'SF Pro Display'` beziehungsweise Geist 700
- Zahlen: immer `tabular-nums`

**Begründung:**

- 87 % des Webs laden Webfonts.
- Die Systemschrift ist die schnellste und wirkt auf jedem Gerät nativ.
- Geist ist die variable Rückfallschrift, als WOFF2 mitgeliefert.

| Stufe | Größe / Zeile | Gewicht | Einsatz |
|---|---|---|---|
| Display | 40–56 / 1,06 | 700, −0,03 em | Projekttitel, Kennzahlen |
| Titel 1 | 32 / 40 | 700 | Seitentitel |
| Titel 2 | 24 / 32 | 650 | Abschnitte |
| Titel 3 | 20 / 28 | 600 | Karten |
| Set-Text | 17 / 22 | 400–600 | Set-App (Apple-Grundgröße) |
| Lesetext | 16 / 24 | 400 | Drehbuch, lange Texte |
| **UI-Text** | **14 / 20** | 400 | Standard (Median aller Systeme) |
| Klein | 13 / 18 | 400–500 | Tabellen, Knöpfe |
| Etikett | 11,5 / 16 | 500, +0,04 em, VERSALIEN | Gruppenüberschriften |

**Regeln:**

- Eingabefelder haben am Telefon mindestens 16 px, sonst zoomt iOS in die Seite.
- Titel werden mit `text-wrap: balance` umbrochen.
- Absätze werden mit `pretty` umbrochen.

---

## 6. Raster, Radius, Größen

**Abstände:**

- Erlaubte Werte: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64.
- Andere Werte gibt es nicht.

**Radius:**

| Element | Radius |
|---|---|
| Etikett / Kbd | 5 |
| Eingabefeld | 10 |
| Knopf | voll rund (Pille) |
| Karte | 16 |
| Dialog / Sheet | 20 |
| Symbolkachel | 8 |

Das liegt oberhalb des Medians von 8. So machen es die jüngeren Systeme (Cloudscape, Gestalt, M3), und es passt zu Apple.

**Steuerelemente:**

| Größe | Höhe |
|---|---|
| Klein | 32 |
| Standard | 36 |
| Groß / Touch | 44 |
| Set-App | 56+ (Shot-Karten) |

Am Touchscreen ist jedes reine Symbol mindestens 36 × 36 groß (siehe `index.css`).

**Fokus:**

- 2 px Ring in `--ring` (Tungsten) mit 2 px Abstand.
- Er federt beim Erscheinen kurz auf (`fokus-an`).

**Schatten:**

- Warm getönt (`--shadow: 20 25% 15%`), weich und weit (0 12 32 −12).
- Nie hart.

---

## 7. Bewegung und Belohnung

### 7.1 Zeit und Kurven

Vorbild sind Apples eigene Werkzeuge: kurz, stark bremsend, **ohne Überschwingen**. Federn mit Nachwippen wirken verspielt und sind ein Erkennungszeichen generierter Oberflächen.

| Token | Dauer | Kurve | Wofür |
|---|---|---|---|
| Druck | 80 ms | linear aus | Knopf gibt nach (scale 0,97) |
| Mikro | 150–180 ms | `cubic-bezier(0.32,0.72,0,1)` | Hover, Farbe, Menüs |
| Standard | 240–360 ms | `(0.32,0.72,0,1)` | Seiten, Kaskade (6 px Weg), Schalter |
| Sheet | 320 ms | `(0.32,0.72,0,1)` | Dialoge, Quittung |
| Fortschritt | 700 ms | `(0.32,0.72,0,1)` | Balken gleiten an ihr Ziel |
| Meilenstein | 1200–1600 ms | `(0.32,0.72,0,1)` | nur der letzte Shot eines Drehtags |

Der Median der Top-Systeme liegt bei 200 ms. Unsere Alltagsdauern liegen im Band P25–P75 (115–300 ms). Keine Animation blockiert die nächste Eingabe.

### 7.2 Die Rückmeldungs-Treppe

Eine Rückmeldung ist so groß wie das, was geschafft wurde, und nie größer.

1. **Berührung:** Der Knopf gibt nach (scale 0,97). Primärknöpfe werden beim Überfahren minimal dunkler. Es gibt keine Welle, kein Leuchten und kein Anheben.
2. **Häkchen:** Der Kasten atmet einmal (260 ms). Am Telefon kommt ein Haptik-Tick (10 ms) dazu.
3. **Gespeichert:** Ein HUD aus Material (Unschärfe, halbtransparent) gleitet unten ein und zeichnet sein Häkchen. Das passiert nach *jedem* erfolgreichen Schreibvorgang, automatisch über den `MutationCache`.
4. **Meilenstein:** Beim letzten Shot des Drehtags gibt es einen kurzen Funkenregen in Tungsten und „Drehtag im Kasten“.

Umsetzung: `client/src/lib/belohnung.ts`. Es gibt eine eigene feste Ebene, React-Knoten werden nicht angefasst.

**API:**

- `feiern(element | {x,y}, stark?)`
- `gespeichert(text?)`
- `tippen(ms?)`
- `data-feiern="gross"` an einem Element
- `meta: { stumm: true }` unterdrückt die Quittung für eine Mutation

### 7.3 Was wir bewusst nicht tun

- Keine Serien („5 Tage in Folge!“), keine Punkte, keine Ranglisten.
- Keine künstlichen Countdowns, keine roten Punkte ohne echten Anlass.
- Kein Pop-up, das zum Weitermachen drängt.
- Keine Animation, die auf die nächste Eingabe warten lässt.

Die App soll sich gut anfühlen, weil Arbeit sichtbar vorangeht, nicht weil sie Aufmerksamkeit abgreift.

### 7.4 Bewegung reduzieren

Bei `prefers-reduced-motion: reduce` gilt:

- Funken, Kaskaden und jede Bewegung mit Weg entfallen.
- Übergänge werden zu kurzem Überblenden (≤ 150 ms).
- Die Quittung erscheint ohne Bewegung.
- Die Haptik schweigt.

---

## 8. Regeln und Gegenbeispiele

| Tu das | Nicht das |
|---|---|
| Ein primärer Knopf pro Ansicht, in Tungsten | Zwei orange Knöpfe nebeneinander |
| Status = Symbol + Wort + Farbe | Nur ein farbiger Punkt |
| Blau nur für Info-Hinweise | Blaue Links neben orangen Knöpfen |
| Karmin für Löschen / Fehler | Orange-Rot für Fehler (verwechselbar mit Tungsten) |
| Abstände aus dem 4er-Raster | 7 px, 15 px, 18 px |
| 14 px UI, 16 px Lesetext, 17 px Set-App | 12 px Fließtext |
| Warme Grautöne aus den Tokens | `gray-500`, `slate-*`, `zinc-*` direkt |
| Feiern nur bei echtem Fortschritt | Konfetti beim Öffnen einer Seite |
| Dauer 150–300 ms | Übergänge über 500 ms, die Eingaben blockieren |

---

## 9. Handwerk statt Generator

Generierte Oberflächen erkennt man an wiederkehrenden Mustern. CutSheet vermeidet sie bewusst. Die Liste ist als Prüfliste für jede neue Seite gedacht.

| Merkmal generierter Apps | So macht es CutSheet |
|---|---|
| Bunte Symbolkacheln, Farbverläufe, Leuchteffekte | Symbole neutral in `foreground/70` auf `foreground/6 %`, keine Verläufe, kein Glühen |
| Jede Zeile eine eigene Karte mit Rand | Gruppierte Listen wie in den iOS-Einstellungen: eine Fläche, Trennlinien |
| Kleine Versal-Etiketten mit Sperrung | Satzschreibung, 12–13 px, halbfett. Daten in Versalien (INT, EXT) bleiben |
| Getönte Pillen mit Rand und Text in derselben Farbe | Status als Wort. Farbe nur, wo sie etwas bedeutet |
| Monospace-Schrift für Zahlen und Zeiten | Systemschrift mit Tabellenziffern. Courier nur im Drehbuch |
| Symbol vor jedem Seitentitel | Große Titel ohne Symbol |
| Knöpfe, die „Kommt bald!“ melden | Jeder Knopf tut, was er sagt, oder er fehlt |
| Ausrufezeichen, „leicht gemacht“, „Oops“ | Sachliche Sätze, Gedankenstrich statt Bindestrich |
| Material-Wellen, Lichtkegel unter der Maus, Dauerglanz | Druck, Häkchen, HUD. Bewegung ohne Überschwingen |
| Schwere Unschärfe hinter Dialogen | Leichtes Abdunkeln (Schwarz 30 %), keine Unschärfe |

**Farbfamilien:** Alle Tailwind-Farben (rot bis pink, dazu ein warmes Grau) werden in `tailwind.config.ts` aus OKLCH neu erzeugt. Jede Familie hat die gleichen Helligkeitsstufen und eine gedämpfte Sättigung. Die Stufe 600 erreicht auf Weiß mindestens 4,6:1, die Stufe 400 auf der dunklen Karte mindestens 7:1.

---

## Anhang A: Die Top 100 nach Kategorie

**Ränge 1–10** sind in Abschnitt 1.1 belegt. Die übrigen Einträge sind nach Similarweb- und Semrush-Berichten 2025–2026 zusammengestellt. Sie stehen **nach Kategorie, nicht nach Rang**, weil einzelne Ränge monatlich schwanken.

1. **Suche und Portale (15):**
   - google.com, bing.com, yahoo.com, yahoo.co.jp, yandex.ru, ya.ru, baidu.com, duckduckgo.com, naver.com, msn.com, dzen.ru, mail.ru
   - google.de, google.co.uk, google.com.br
2. **Soziale Netzwerke und Messenger (17):**
   - youtube.com, facebook.com, instagram.com, x.com, reddit.com, tiktok.com, whatsapp.com, linkedin.com, pinterest.com, vk.com, ok.ru, discord.com, telegram.org, quora.com, twitch.tv, bilibili.com, fandom.com
3. **KI-Assistenten (7):**
   - chatgpt.com, gemini.google.com, claude.ai, perplexity.ai, deepseek.com, character.ai, copilot.microsoft.com
4. **Handel (14):**
   - amazon.com, amazon.co.jp, amazon.de, ebay.com, temu.com, aliexpress.com, shein.com, walmart.com, etsy.com, taobao.com, avito.ru, ozon.ru, wildberries.ru, booking.com
5. **Produktivität und Cloud (14):**
   - live.com, office.com, microsoftonline.com, microsoft.com, sharepoint.com, cloud.microsoft, zoom.us, canva.com, github.com, stackoverflow.com, apple.com, icloud.com, adobe.com, paypal.com
6. **Video und Musik (9):**
   - netflix.com, spotify.com, max.com, disneyplus.com, primevideo.com, roblox.com, imdb.com, globo.com, samsung.com
7. **Nachrichten und Wetter (14):**
   - weather.com, accuweather.com, cnn.com, bbc.com, bbc.co.uk, nytimes.com, foxnews.com, dailymail.co.uk, theguardian.com, espn.com, news.yahoo.co.jp, usps.com, indeed.com, zillow.com
8. **Wissen (2):**
   - wikipedia.org, wikimedia.org
9. **Nicht jugendfreie Seiten (8):**
   - Mehrere große Portale liegen regelmäßig in den Top 100.
   - Sie wurden nicht ausgewertet.

**Summe: 100.**

---

## Anhang B: Nachvollziehbarkeit

- Die Rohwerte pro System liegen in `docs/praesentation/design-messung/systeme.json`, die Auswertung in `stat.json`. Das Skript `stat.py` berechnet sie neu (aus dem Repo-Stamm starten).
- **Kontraste:** WCAG 2.2 relative Leuchtdichte.
- **Palettenprüfung:**
  - Helligkeitsband und Sättigung in OKLCH.
  - Farbenblind-Simulation nach Machado, Oliveira und Fernandes 2009.
  - ΔE in OKLab ×100.
- **Quellen:**
  - Similarweb Top Websites Ranking, August 2026.
  - HTTP Archive Web Almanac 2024 (Kapitel Fonts, CSS).
  - npm-Pakete wie in Abschnitt 1.2 aufgeführt.
