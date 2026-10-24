# -*- coding: utf-8 -*-
"""
Liste aller Quelldateien mit Zeilenzahl, gruppiert - als Abhakliste.

Gebraucht für die Codeprüfung in docs/CODEPRUEFUNG.md: Dort steht jede Datei
einmal, und wer sie gelesen hat, setzt den Haken. Bei neuen Dateien die Liste
neu erzeugen und mit dem Stand in der Übergabe abgleichen.

    python scripts/dateiliste.py > liste.md
"""
import io
import os

GRUPPEN = [
    ('Server: Middleware', 'server/src/middleware'),
    ('Server: Datenbank', 'server/src/db'),
    ('Server: Routen', 'server/src/routes'),
    ('Server: Bibliotheken', 'server/src/lib'),
    ('Server: Skripte', 'server/src/scripts'),
    ('Server: Rest', 'server/src'),
    ('Client: Bibliotheken', 'client/src/lib'),
    ('Client: Kontexte', 'client/src/contexts'),
    ('Client: Hooks', 'client/src/hooks'),
    ('Client: Komponenten', 'client/src/components'),
    ('Client: Seiten', 'client/src/pages'),
    ('Client: Rest', 'client/src'),
    ('Werkzeuge', 'scripts'),
    ('Server: Tests', 'server/src/__tests__'),
]
ENDUNGEN = ('.ts', '.tsx', '.js', '.cjs', '.py', '.css')


def main():
    gesehen = set()
    gesamt = 0
    zeilen = []
    for name, ordner in GRUPPEN:
        dateien = []
        for verz, _, namen in os.walk(ordner):
            verz = verz.replace(os.sep, '/')
            if 'node_modules' in verz:
                continue
            # "Rest" heisst: nur die Dateien direkt im Ordner, nicht darunter
            if name.endswith('Rest') and verz != ordner:
                continue
            if name != 'Server: Tests' and '/__tests__' in verz:
                continue
            for f in namen:
                pfad = verz + '/' + f
                if pfad.endswith(ENDUNGEN) and pfad not in gesehen:
                    dateien.append(pfad)
        if not dateien:
            continue
        dateien.sort()
        zeilen.append('')
        zeilen.append('### ' + name)
        zeilen.append('')
        for pfad in dateien:
            gesehen.add(pfad)
            with io.open(pfad, encoding='utf-8', errors='replace') as d:
                n = sum(1 for _ in d)
            gesamt += n
            zeilen.append('- [ ] `%s` (%d)' % (pfad, n))
    print('Gesamt: %d Dateien, %d Zeilen' % (len(gesehen), gesamt))
    print('\n'.join(zeilen))


if __name__ == '__main__':
    main()
