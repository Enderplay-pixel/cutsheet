import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

/** Texte rund um die Einführungen: das Fenster selbst, Kopfleiste, Einstellungen. */
export const einfuehrungT = {
  schritt:         { de: 'Schritt {a} von {b}', en: 'Step {a} of {b}', fr: 'Étape {a} sur {b}' },
  weiter:          { de: 'Weiter', en: 'Next', fr: 'Suivant' },
  zurueck:         { de: 'Zurück', en: 'Back', fr: 'Retour' },
  fertig:          { de: 'Verstanden', en: 'Got it', fr: 'Compris' },
  ueberspringen:   { de: 'Überspringen', en: 'Skip', fr: 'Passer' },
  zusammenhang:    { de: 'Hängt zusammen mit', en: 'Connected to', fr: 'Lié à' },
  starten:         { de: 'Einführung zu dieser Seite', en: 'Introduction to this page', fr: 'Présentation de cette page' },
  einstellungen:   { de: 'Einführungen', en: 'Introductions', fr: 'Présentations' },
  einstellungenText: { de: 'Beim ersten Öffnen einer Seite zeigt CutSheet in ein paar Schritten, wofür sie da ist und wohin eine Eingabe dort weiterwirkt.', en: 'The first time you open a page, CutSheet shows in a few steps what it is for and where an entry there carries over to.', fr: "À la première ouverture d'une page, CutSheet montre en quelques étapes à quoi elle sert et où une saisie se répercute." },
  gesehen:         { de: 'Schon gesehen: {n}', en: 'Already seen: {n}', fr: 'Déjà vues : {n}' },
  erneut:          { de: 'Alle erneut zeigen', en: 'Show all again', fr: 'Tout réafficher' },
  erneutFertig:    { de: 'Die Einführungen erscheinen wieder beim nächsten Öffnen jeder Seite.', en: 'The introductions will appear again the next time you open each page.', fr: 'Les présentations réapparaîtront à la prochaine ouverture de chaque page.' },
} satisfies Record<string, Text>
