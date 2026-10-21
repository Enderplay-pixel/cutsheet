import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const impressumT = {
  // Nur in Englisch und Französisch sichtbar - die deutsche Fassung ist die verbindliche.
  hinweis: {
    de: '',
    en: 'This translation is provided for convenience only. The German version is legally binding.',
    fr: "Cette traduction est fournie à titre indicatif uniquement. Seule la version allemande fait foi.",
  },
  titel: { de: 'Impressum', en: 'Legal notice (Impressum)', fr: 'Mentions légales (Impressum)' },
  angaben: {
    de: 'Angaben gemäß § 5 TMG',
    en: 'Information pursuant to § 5 TMG (German Telemedia Act)',
    fr: 'Informations conformément au § 5 TMG (loi allemande sur les télémédias)',
  },
  betreiberName: {
    de: '[VOR- UND NACHNAME DES BETREIBERS]',
    en: "[OPERATOR'S FIRST AND LAST NAME]",
    fr: "[PRÉNOM ET NOM DE L'EXPLOITANT]",
  },
  strasse: { de: '[STRASSE UND HAUSNUMMER]', en: '[STREET AND HOUSE NUMBER]', fr: '[RUE ET NUMÉRO]' },
  ort: { de: '[PLZ UND ORT]', en: '[POSTCODE AND TOWN]', fr: '[CODE POSTAL ET VILLE]' },
  land: { de: 'Deutschland', en: 'Germany', fr: 'Allemagne' },
  kontakt: { de: 'Kontakt', en: 'Contact', fr: 'Contact' },
  email: { de: 'E-Mail: [KONTAKT-E-MAIL]', en: 'Email: [CONTACT EMAIL]', fr: 'E-mail : [E-MAIL DE CONTACT]' },
  telefon: {
    de: 'Telefon: [TELEFONNUMMER, optional]',
    en: 'Phone: [PHONE NUMBER, optional]',
    fr: 'Téléphone : [NUMÉRO DE TÉLÉPHONE, facultatif]',
  },
  verantwortlich: {
    de: 'Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV',
    en: 'Responsible for content pursuant to § 18(2) MStV (German Interstate Media Treaty)',
    fr: 'Responsable du contenu selon le § 18, al. 2 MStV (traité inter-Länder allemand sur les médias)',
  },
  verantwortlichName: {
    de: '[VOR- UND NACHNAME], Anschrift wie oben.',
    en: '[FIRST AND LAST NAME], address as above.',
    fr: '[PRÉNOM ET NOM], adresse indiquée ci-dessus.',
  },
  haftungInhalte: { de: 'Haftung für Inhalte', en: 'Liability for content', fr: 'Responsabilité quant aux contenus' },
  haftungInhalteText: {
    de: 'Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.',
    en: 'As a service provider, we are responsible for our own content on these pages under general law pursuant to § 7(1) TMG. Under §§ 8 to 10 TMG, however, we as a service provider are not obliged to monitor transmitted or stored third-party information or to investigate circumstances that indicate unlawful activity.',
    fr: "En tant que prestataire de services, nous sommes responsables de nos propres contenus sur ces pages conformément au § 7, al. 1 TMG et au droit commun. Selon les §§ 8 à 10 TMG, nous ne sommes toutefois pas tenus, en tant que prestataire de services, de surveiller les informations de tiers transmises ou stockées, ni de rechercher des circonstances révélant une activité illicite.",
  },
  haftungLinks: { de: 'Haftung für Links', en: 'Liability for links', fr: 'Responsabilité quant aux liens' },
  haftungLinksText: {
    de: 'Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.',
    en: 'Our service contains links to external third-party websites whose content we have no influence over. We therefore cannot accept any liability for this third-party content. The respective provider or operator of the linked pages is always responsible for their content.',
    fr: "Notre service contient des liens vers des sites web externes de tiers, sur le contenu desquels nous n'avons aucune influence. Nous ne pouvons donc assumer aucune garantie pour ces contenus de tiers. Le fournisseur ou l'exploitant respectif des pages liées est toujours responsable de leur contenu.",
  },
  zurueck: { de: 'Zurück zur Anmeldung', en: 'Back to sign-in', fr: 'Retour à la connexion' },
} satisfies Record<string, Text>
