"""
Prüft, ob jeder relative und jeder @/-Import mit exakter Groß- und
Kleinschreibung auf eine vorhandene Datei zeigt.

    python scripts/importe-pruefen.py

Windows ignoriert die Schreibweise, Render baut auf Linux - dort bricht ein
Import "./Zeitanalyse" für die Datei "ZeitAnalyse.tsx" den Build. Lokal
fällt das nie auf.
"""
import os
import re
import sys

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUELLEN = [os.path.join(WURZEL, 'client', 'src'), os.path.join(WURZEL, 'server', 'src')]
ALIAS = {'@/': os.path.join(WURZEL, 'client', 'src')}
ENDUNGEN = ['', '.ts', '.tsx', '.js', '.jsx', '.json', '/index.ts', '/index.tsx', '/index.js']
IMPORT = re.compile(r"""(?:from\s+|import\s*\(\s*|require\(\s*|import\s+)['"]([^'"]+)['"]""")


def existiert_exakt(pfad: str) -> bool:
    """True, wenn jeder Pfadteil genau so im Verzeichnis steht."""
    teile = os.path.normpath(pfad).split(os.sep)
    aktuell = teile[0] + os.sep
    for teil in teile[1:]:
        try:
            eintraege = os.listdir(aktuell)
        except OSError:
            return False
        if teil not in eintraege:
            return False
        aktuell = os.path.join(aktuell, teil)
    return True


def aufloesen(von: str, ziel: str) -> str | None:
    if ziel.startswith('.'):
        basis = os.path.normpath(os.path.join(os.path.dirname(von), ziel))
    elif any(ziel.startswith(a) for a in ALIAS):
        a = next(a for a in ALIAS if ziel.startswith(a))
        basis = os.path.normpath(os.path.join(ALIAS[a], ziel[len(a):]))
    else:
        return None  # Paket
    for endung in ENDUNGEN:
        kandidat = basis + endung.replace('/', os.sep)
        if os.path.isfile(kandidat):
            return kandidat
    return basis + '?'


fehler = []
gezaehlt = 0
for quelle in QUELLEN:
    for ordner, _, dateien in os.walk(quelle):
        if 'node_modules' in ordner:
            continue
        for datei in dateien:
            if not datei.endswith(('.ts', '.tsx')):
                continue
            pfad = os.path.join(ordner, datei)
            with open(pfad, encoding='utf-8') as f:
                inhalt = f.read()
            for m in IMPORT.finditer(inhalt):
                ziel = aufloesen(pfad, m.group(1))
                if ziel is None:
                    continue
                gezaehlt += 1
                if ziel.endswith('?') or not existiert_exakt(ziel):
                    fehler.append(f'{os.path.relpath(pfad, WURZEL)}: {m.group(1)}')

print(f'{gezaehlt} Importe geprüft, {len(fehler)} passen nicht exakt')
for f in fehler:
    print('  ' + f)
sys.exit(1 if fehler else 0)
