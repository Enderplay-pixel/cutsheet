import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

/** Arbeitszeit-Prüfung in den Stammdaten (Plan Kino-Ausbau, AP B3). */
export const arbeitszeitT = {
  abschnitt: { de: 'Arbeitszeit', en: 'Working time', fr: 'Temps de travail' },
  regel: { de: 'Regel der Prüfung', en: 'Rule for the check', fr: 'Règle du contrôle' },
  gesetz: { de: 'Gesetz (Arbeitszeitgesetz)', en: 'Law (Working Hours Act)', fr: 'Loi (loi sur le temps de travail)' },
  tarif: { de: 'Tarifvertrag (TV FFS)', en: 'Collective agreement (TV FFS)', fr: 'Convention collective (TV FFS)' },
  stundenJeGage: { de: 'Stunden je Tagesgage', en: 'Hours per day rate', fr: 'Heures par cachet journalier' },
  stundenJeGageHilfe: {
    de: 'Stundensatz = Tagesgage geteilt durch diese Zahl. Stunden darüber werden mit ihrem Zuschlag bezahlt.',
    en: 'Hourly rate = day rate divided by this number. Hours beyond it are paid with their surcharge.',
    fr: 'Taux horaire = cachet journalier divisé par ce nombre. Les heures au-delà sont payées avec leur majoration.',
  },
  saetze: { de: 'Zuschläge in Prozent', en: 'Surcharges in percent', fr: 'Majorations en pourcentage' },
  elfte: { de: 'Erste Überstunde', en: 'First overtime hour', fr: 'Première heure supplémentaire' },
  ab_zwoelfte: { de: 'Ab der zweiten Überstunde', en: 'From the second overtime hour', fr: 'À partir de la deuxième heure supplémentaire' },
  nacht: { de: 'Nachtstunde', en: 'Night hour', fr: 'Heure de nuit' },
  sonntag: { de: 'Sonntag', en: 'Sunday', fr: 'Dimanche' },
  feiertag: { de: 'Feiertag', en: 'Public holiday', fr: 'Jour férié' },
  nachtVon: { de: 'Nachtzeit von', en: 'Night time from', fr: 'Heures de nuit de' },
  nachtBis: { de: 'Nachtzeit bis', en: 'Night time to', fr: 'Heures de nuit à' },
  gesetzHinweis: {
    de: 'Zuschläge regelt der Vertrag - das Gesetz schreibt keine Sätze vor. Ohne Eintrag zählt 0 %.',
    en: 'Surcharges are set by the contract - the law sets no rates. Without an entry 0 % applies.',
    fr: 'Les majorations relèvent du contrat - la loi ne fixe pas de taux. Sans saisie, 0 % s’applique.',
  },
  tarifHinweis: {
    de: 'Die Zuschlagssätze des TV FFS liegen CutSheet nicht im Wortlaut vor - bitte nach eurem Vertrag eintragen.',
    en: 'CutSheet does not have the TV FFS rates verbatim - please enter them from your agreement.',
    fr: 'CutSheet ne dispose pas des taux du TV FFS dans leur texte - merci de les saisir selon votre convention.',
  },
  nachtVorschlag: {
    de: 'Der Tarifvertrag nennt laut Suchtreffer 22 bis 6 Uhr als Nachtzeit (nicht im Wortlaut geprüft).',
    en: 'According to a search result the agreement names 22:00 to 6:00 as night time (not checked verbatim).',
    fr: 'Selon un résultat de recherche, la convention fixe la nuit de 22 h à 6 h (texte non vérifié).',
  },
  nachtUebernehmen: { de: '22 bis 6 Uhr übernehmen', en: 'Use 22:00 to 6:00', fr: 'Appliquer 22 h à 6 h' },
  quelle: {
    de: 'Quellen, Stand 14.11.2026: Arbeitszeitgesetz (§ 3 höchstens 10 Stunden, § 4 Pausen, § 5 elf Stunden Ruhezeit, § 11 Ersatzruhetag; Nachtzeit 23 bis 6 Uhr nach § 2). TV FFS laut ver.di vom 12.10.2024: höchstens 12 Stunden am Tag, über 10 zuschlagspflichtig. Die Prüfung meldet nach eingestellter Regel, sie sperrt nichts.',
    en: 'Sources as of 14.11.2026: German Working Hours Act (§ 3 at most 10 hours, § 4 breaks, § 5 eleven hours of rest, § 11 substitute rest day; night 23:00 to 6:00 per § 2). TV FFS per ver.di of 12.10.2024: at most 12 hours a day, above 10 subject to surcharge. The check reports under the configured rule; it blocks nothing.',
    fr: 'Sources au 14.11.2026 : loi allemande sur le temps de travail (§ 3 au plus 10 heures, § 4 pauses, § 5 onze heures de repos, § 11 jour de repos compensateur ; nuit de 23 h à 6 h selon § 2). TV FFS selon ver.di du 12.10.2024 : au plus 12 heures par jour, majoration au-delà de 10. Le contrôle signale selon la règle choisie, il ne bloque rien.',
  },
} satisfies Record<string, Text>
