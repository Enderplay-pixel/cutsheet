/**
 * Die Version, die in der Oberfläche steht.
 *
 * **Eine** Stelle, sonst läuft die Zahl auseinander: Sie erscheint im
 * Seitentitel, in der Seitenleiste, auf der Anmeldeseite, im Impressum und
 * auf der Einladungsseite. Wer sie an fünf Orten pflegt, pflegt sie an
 * dreien.
 *
 * ## Wann sie hochgeht
 *
 * Bei einem **großen** Wechsel, nicht bei jeder Korrektur. Groß heißt: ein
 * neues Modul ist dazugekommen, ein bestehendes arbeitet anders, oder etwas
 * ist weggefallen, das jemand benutzt hat. Also das, was man jemandem
 * erzählen würde, der die Anwendung kennt.
 *
 * Nicht groß: ein behobener Fehler, ein umformulierter Text, eine schnellere
 * Abfrage, eine Übersetzung.
 *
 * `alpha` bleibt stehen, solange die Anwendung nicht in einer echten
 * Produktion gelaufen ist. Danach wird daraus `beta` und irgendwann nichts
 * mehr.
 */
export const VERSION = 'v1.2 alpha'

/** Seit wann diese Version steht - für den Fußbereich und zum Nachsehen. */
export const VERSION_STAND = '2026-11-08'

/**
 * Was sich in dieser Version geändert hat, in einem Satz.
 *
 * Zum Nachschlagen - angezeigt wird sie derzeit nirgends (Stand 26.10.2026).
 * Nicht länger als eine Zeile - das Ausführliche steht in `docs/RUNDEN.md`.
 */
export const VERSION_NOTIZ = 'Dein Arbeitsplatz: Bereiche und Abschnitte frei anordnen, Einführung auf jeder Seite'

/** Für den Seitentitel: "CutSheet v1.2 alpha - Filmproduktion". */
export const SEITENTITEL = `CutSheet ${VERSION} - Filmproduktion`
