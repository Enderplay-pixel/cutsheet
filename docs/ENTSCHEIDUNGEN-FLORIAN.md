# Entscheidungen für Florian

Was der Dauerlauf nicht allein entscheiden durfte. Je Punkt: worum es geht,
was dafür und dagegen spricht, und was zu tun wäre.

## 1. Alte Zahlungen nachtragen (Live-Datenbank)

**Worum es geht:** Bis 19.10.2026 schrieb der Knopf „Zahlung erfasst" auf der
Rechnungsseite nur `invoices.paid_cents`, ohne Zeile in `invoice_payments`.
Offene Posten und Mahnwesen rechnen aber mit diesen Zeilen. Folge in der
Live-Datenbank: Eine so bezahlte Rechnung steht unter Offene Posten weiter
offen und wird zur Mahnung vorgeschlagen. Kommt später über die
Offene-Posten-Seite eine Teilzahlung dazu, überschreibt sie `paid_cents` mit
der Summe der Zeilen, und die alte Zahlung ist weg.

Der Knopf ist behoben (Commit dieser Runde). Bestehende Daten nicht.

**Vorschlag:** Einmalig den Unterschied als Zahlungszeile nachtragen. Der
Dauerlauf hat das als Migration beim Serverstart gebaut, die Rechteprüfung hat
es abgelehnt, weil es beim nächsten Deploy ohne Rückfrage Live-Daten schreibt.
Das ist deine Entscheidung.

Vorher nachsehen, ob es überhaupt betroffene Rechnungen gibt:

```sql
SELECT i.id, i.number, i.paid_cents, COALESCE(z.summe, 0) AS zeilen
  FROM invoices i
  LEFT JOIN (SELECT invoice_id, SUM(amount_cents) AS summe FROM invoice_payments GROUP BY invoice_id) z
    ON z.invoice_id = i.id
 WHERE i.paid_cents > COALESCE(z.summe, 0);
```

Nachtragen (wiederholbar, ein zweiter Lauf findet nichts mehr):

```sql
INSERT INTO invoice_payments (invoice_id, amount_cents, paid_on, note)
SELECT i.id, i.paid_cents - COALESCE(z.summe, 0),
       COALESCE(i.paid_at, i.updated_at::date, CURRENT_DATE),
       'Nachgetragen: auf der Rechnungsseite erfasst'
  FROM invoices i
  LEFT JOIN (SELECT invoice_id, SUM(amount_cents) AS summe FROM invoice_payments GROUP BY invoice_id) z
    ON z.invoice_id = i.id
 WHERE i.paid_cents > COALESCE(z.summe, 0);
```

Liefert die erste Abfrage nichts, ist nichts zu tun.

## 2. Testkonto `ensureTestAdmin()`

Die Vault-Notiz `Coding Vault/Apps/CutSheet.md` sagt, das Konto werde bei
jedem Start mit fest eingebautem Passwort angelegt. Im Code liest es
inzwischen `TEST_ADMIN_PASSWORD` aus der Umgebung und legt bei zu kurzem
Passwort nichts an. Der Dauerlauf hat die Funktion nicht angefasst (deine
offene Entscheidung). Ob die Notiz veraltet ist oder das Konto in der
Produktion trotzdem existiert, lässt sich nur im Render-Dashboard bzw. in der
Live-Datenbank prüfen.

## 3. Zeitzone auf Render

Alle Datums- und Zeitangaben im Server stehen jetzt ausdrücklich auf
Europe/Berlin. Ob Render bisher in UTC lief (dann waren Sonnenzeiten im
Morning Brief zwei Stunden zu früh), ist nicht gemessen - in `render.yaml`
ist keine Zone gesetzt. Mit dem nächsten Deploy ist es so oder so richtig.
