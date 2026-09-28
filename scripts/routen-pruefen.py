#!/usr/bin/env python3
"""
Prueft, ob jeder API-Aufruf im Client eine passende Route im Server hat.

Anlass: Im Test mit der Grossproduktion fielen gleich mehrere Seiten auf, die
Pfade oder Methoden benutzten, die es im Server nicht gab - Kameraberichte
(GET .../takes, /takes/:id), Continuity (PATCH /projects/:pid/continuity/:id),
Sperrtage (POST ohne Darsteller im Pfad), Timesheets (PATCH statt PUT). Die
Aktion scheiterte jeweils still mit 404.

Aufruf:  python3 scripts/routen-pruefen.py      (Exit-Code 1 bei Befund)
"""
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Router, die unter einem Praefix eingehaengt sind (server/src/index.ts)
PRAEFIX = {'projects.ts': '/api/projects', 'auth.ts': '/api/auth', 'admin.ts': '/api/admin'}


def muster(pfad: str):
    return re.compile('^' + re.sub(r':[A-Za-z_]+', r'[^/]+', pfad) + '/?$')


def server_routen():
    routen = []
    for datei in glob.glob(os.path.join(ROOT, 'server/src/routes/*.ts')) + [os.path.join(ROOT, 'server/src/index.ts')]:
        text = open(datei, encoding='utf8').read()
        praefix = PRAEFIX.get(os.path.basename(datei), '')
        for m in re.finditer(r"(?:router|app)\.(get|post|put|patch|delete)\(\s*\[?\s*'([^']+)'", text):
            pfad = m.group(2)
            if not praefix and not pfad.startswith('/api'):
                pfad = '/api' + pfad
            voll = praefix + ('' if pfad == '/' else pfad)
            routen.append((m.group(1).upper(), muster(voll)))
    return routen


def client_aufrufe():
    aufrufe = set()
    for datei in glob.glob(os.path.join(ROOT, 'client/src/**/*.ts*'), recursive=True):
        text = open(datei, encoding='utf8').read()
        for m in re.finditer(
            r"(req(?:<[^>]*>)?|fetch|adminFetch|fetchMitWiederholung)\(\s*[`'\"]([^`'\"]+)[`'\"]\s*(?:,\s*\{[^}]*?method:\s*'(\w+)')?",
            text,
        ):
            art, pfad, methode = m.group(1), m.group(2), (m.group(3) or 'GET').upper()
            if pfad.startswith('http') or pfad.startswith('${'):
                continue  # externe Dienste bzw. dynamisch zusammengesetzt
            pfad = re.sub(r'\$\{[^}]+\}', ':x', pfad).split('?')[0].split('${')[0]
            if art == 'adminFetch':
                pfad = '/api/admin' + pfad
            elif not pfad.startswith('/api'):
                pfad = '/api' + pfad
            if pfad.startswith('/api/uploads') or re.fullmatch(r'/api(/admin)?:x', pfad):
                continue  # Dateien bzw. die Hilfsfunktion selbst (fetch(`/api${path}`))
            aufrufe.add((methode, pfad, os.path.relpath(datei, ROOT)))
    return aufrufe


def main():
    routen = server_routen()
    fehlend = sorted(
        (methode, pfad, datei)
        for methode, pfad, datei in client_aufrufe()
        if not any(m == methode and r.match(pfad) for m, r in routen)
    )
    if not fehlend:
        print('Alle API-Aufrufe des Clients haben eine Server-Route.')
        return 0
    print(f'{len(fehlend)} API-Aufruf(e) ohne passende Server-Route:')
    for methode, pfad, datei in fehlend:
        print(f'  {methode:6} {pfad:55} {datei}')
    return 1


if __name__ == '__main__':
    sys.exit(main())
