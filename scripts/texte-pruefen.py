"""
Findet sichtbare Texte in .tsx-Dateien, die nicht über tt(...) laufen.

    python scripts/texte-pruefen.py client/src/pages/Rechnungen.tsx [weitere ...]

Gemeldet werden JSX-Textknoten und Texte in placeholder, title, aria-label,
label, description sowie in toast({ title / description }) und confirm(),
sofern sie Buchstaben enthalten. Eine Heuristik: Sie findet fast alles, was
übersehen wurde, und meldet gelegentlich etwas, das keine Oberfläche ist
(etwa Einheiten wie "px"). Solche Zeilen lassen sich mit dem Kommentar
`// texte-ok` am Zeilenende ausnehmen - sparsam und nur mit Grund.

Rückgabe: Anzahl Funde je Datei, Exitcode 1 bei Funden.
"""
import re
import sys

KOMMENTAR = re.compile(r'^\s*(//|\*|/\*|\{/\*)')
# Text zwischen > und <, der kein Ausdruck ist
JSX_TEXT = re.compile(r'>([^<>{}]*[A-Za-zÄÖÜäöüß]{2,}[^<>{}]*)<')
JSX_TEXT_ZEILE = re.compile(r'^\s*([A-Za-zÄÖÜäöüß][^<>{}=;]*[A-Za-zÄÖÜäöüß.!?:)])\s*$')
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
