"""
Findet sichtbare Texte in .tsx-Dateien, die nicht über tt(...) laufen.

    python scripts/texte-pruefen.py client/src/pages/Rechnungen.tsx [weitere ...]

Gemeldet werden JSX-Textknoten und Texte in placeholder, title, aria-label,
label, description sowie in toast({ title / description }) und confirm(),
sofern sie Buchstaben enthalten. Eine Heuristik: Sie findet fast alles, was
übersehen wurde, und meldet gelegentlich etwas, das keine Oberfläche ist
(etwa Einheiten wie "px"). Solche Zeilen lassen sich mit dem Kommentar
`// texte-ok` am Zeilenende ausnehmen - sparsam und nur mit Grund.

Seit 03.11.2026 auch Texte in Verzweigungen (`a ? 'Notiz…' : …`,
`titel || 'Ohne Titel'`), sofern sie wie Sätze aussehen (Leerzeichen oder
"…"), und Textzeilen, die auf "…" enden. Beides fiel vorher durch - gemessen
am Drehbuch-Editor: vier Platzhalter, "Untitled" und "Klicken um Inhalt
hinzuzufügen…" standen nicht in der Zählung.

Rückgabe: Anzahl Funde je Datei, Exitcode 1 bei Funden.
"""
import re
import sys

KOMMENTAR = re.compile(r'^\s*(//|\*|/\*|\{/\*)')
# Text zwischen > und <, der kein Ausdruck ist
JSX_TEXT = re.compile(r'>([^<>{}]*[A-Za-zÄÖÜäöüß]{2,}[^<>{}]*)<')
JSX_TEXT_ZEILE = re.compile(r'^\s*([A-Za-zÄÖÜäöüß][^<>{}=;]*[A-Za-zÄÖÜäöüß.!?:)…])\s*$')
# Text als Zweig einer Verzweigung: nach ?, :, || oder ??
VERZWEIGUNG = re.compile(r"(?:\?\?|\|\||\?|:)\s*'([A-Za-zÄÖÜäöüß][^'\n]*?(?: |…)[^'\n]*)'")
ATTRIBUT = re.compile(r'\b(placeholder|title|aria-label|label|description|alt)=["\']([^"\']*[A-Za-zÄÖÜäöüß]{2,}[^"\']*)["\']')
AUFRUF = re.compile(r"\b(title|description|label):\s*['\"`]([^'\"`]*[A-Za-zÄÖÜäöüß]{2,}[^'\"`]*)['\"`]")
CONFIRM = re.compile(r"\bconfirm\(\s*['\"`]")
AUSNAHMEN = {'CutSheet', 'DATEV', 'KSK', 'PDF', 'CSV', 'URL', 'ID', 'OK', 'IBAN', 'BIC', 'E-Mail', 'YouTube', 'QR'}


def ist_ausnahme(text: str) -> bool:
    rein = text.strip()
    if not rein or rein in AUSNAHMEN:
        return True
    # reine Einheiten, Zahlen, Satzzeichen, Platzhalterformen
    return bool(re.fullmatch(r"[\d\s.,:;/%€·+\-x×()#'\"]*(px|mm|kB|KB|MB|min|h|km|€)?[\d\s.,:;/%€·+\-x×()#'\"]*", rein))


def ist_klassenliste(text: str) -> bool:
    """Tailwind-Klassen wie 'border-foreground scale-110' und CSS-Werte wie
    'rect(0, 0, 0, 0)' sind kein Text."""
    if re.match(r'^[a-z-]+\(', text):
        return True
    teile = text.split()
    return (all(re.fullmatch(r'[a-z0-9\-:\[\]/.%!#()_&>*]+', t) for t in teile)
            and any('-' in t or ':' in t for t in teile))


def pruefe(pfad: str) -> list[str]:
    funde = []
    with open(pfad, encoding='utf-8') as f:
        zeilen = f.read().split('\n')
    for nr, zeile in enumerate(zeilen, 1):
        if KOMMENTAR.match(zeile) or 'texte-ok' in zeile or zeile.lstrip().startswith('import '):
            continue
        treffer = []
        treffer += [m.group(1) for m in JSX_TEXT.finditer(zeile)]
        treffer += [m.group(2) for m in ATTRIBUT.finditer(zeile)]
        treffer += [m.group(2) for m in AUFRUF.finditer(zeile)]
        treffer += [t for t in VERZWEIGUNG.findall(zeile) if t not in treffer and not ist_klassenliste(t)]
        if CONFIRM.search(zeile):
            treffer.append('confirm(...)')
        m = JSX_TEXT_ZEILE.match(zeile)
        # Typzeilen ("id: number") und Aufrufe ("onDone()") sind kein Text
        if m and re.match(r'^\s*[\w.$]+\??\s*[:(]', zeile):
            m = None
        if m and not zeile.strip().startswith(('return', 'const', 'let', 'if', 'else', 'case', 'default', 'export', 'function', 'type', 'interface')):
            treffer.append(m.group(1))
        treffer = [t for t in treffer if not ist_ausnahme(t)]
        if treffer:
            funde.append(f'{pfad}:{nr}: {" | ".join(t.strip()[:60] for t in treffer)}')
    return funde


if __name__ == '__main__':
    alle = []
    for pfad in sys.argv[1:]:
        funde = pruefe(pfad)
        alle += funde
        print(f'{len(funde):4d}  {pfad}')
    if alle:
        print()
        print('\n'.join(alle))
    sys.exit(1 if alle else 0)
