import type { Lang } from '@/lib/i18n'

type Text = Record<Lang, string>

export const creatorRechteT = {
  titel:          { de: 'Rechte & Lizenzen', en: 'Rights & licences', fr: 'Droits & licences' },
  untertitel:     {
    de: 'Musik, Material und Fremdaufnahmen über alle Videos - wo eine Lizenz fehlt',
    en: 'Music, material and third-party footage across all videos - where a licence is missing',
    fr: 'Musique, matériel et images tierces sur toutes les vidéos - là où une licence manque',
  },
  materialGesamt: { de: 'Material gesamt', en: 'Total material', fr: 'Matériel total' },
  ohneLizenz:     { de: 'Ohne Lizenz', en: 'Without licence', fr: 'Sans licence' },
  videosRisiko:   { de: 'Videos mit hohem Risiko', en: 'High-risk videos', fr: 'Vidéos à risque élevé' },
  einTitel:       { de: 'Ein Titel ohne Lizenznachweis', en: 'One track without proof of licence', fr: 'Un titre sans justificatif de licence' },
  nTitel:         { de: '{n} Titel ohne Lizenznachweis', en: '{n} tracks without proof of licence', fr: '{n} titres sans justificatif de licence' },
  warnung:        {
    de: 'Ein einziger ungeklärter Track kann die Monetarisierung des ganzen Videos kosten. Das höchste Einzelrisiko schlägt deshalb auf das Video durch.',
    en: 'A single uncleared track can cost the monetisation of the entire video. That is why the highest individual risk carries over to the video.',
    fr: "Un seul morceau non libéré peut coûter la monétisation de toute la vidéo. C'est pourquoi le risque individuel le plus élevé se répercute sur la vidéo.",
  },
  leerTitel:      { de: 'Noch kein Material erfasst', en: 'No material recorded yet', fr: 'Aucun matériel saisi pour le moment' },
  leerText:       {
    de: 'Musik, Stockmaterial und Fremdaufnahmen werden beim jeweiligen Video eingetragen. Hier stehen sie dann über den ganzen Kanal zusammen.',
    en: 'Music, stock footage and third-party footage are entered on each video. They are then collected here across the whole channel.',
    fr: 'La musique, les images de stock et les images tierces sont saisies dans chaque vidéo. Elles sont ensuite réunies ici pour toute la chaîne.',
  },
  video:          { de: 'Video', en: 'Video', fr: 'Vidéo' },
  material:       { de: 'Material', en: 'Material', fr: 'Matériel' },
  ohneLizenzKlein:{ de: 'ohne Lizenz', en: 'without licence', fr: 'sans licence' },
  risiko:         { de: 'Risiko', en: 'Risk', fr: 'Risque' },
  beanstandungen: { de: 'Beanstandungen', en: 'Issues', fr: 'Problèmes' },
} satisfies Record<string, Text>

/** Beschriftung der Risikostufen; die Schlüssel kommen vom Server. */
export const RISIKO_TEXT: Record<string, Text> = {
  keins:    { de: 'kein Risiko', en: 'no risk', fr: 'aucun risque' },
  moeglich: { de: 'möglich', en: 'possible', fr: 'possible' },
  hoch:     { de: 'hoch', en: 'high', fr: 'élevé' },
}
