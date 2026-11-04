// Source unique des futurs faits historiques. Aucun fait attesté importé à ce stade.
export const historique = Object.freeze({
  schemaVersion: 1, sources: Object.freeze([]), lieux: Object.freeze([])
});
const present = x => typeof x === 'string' && x.trim().length > 0;
const statuts = ['attesté', 'à vérifier'];
const local = x => present(x) && !x.startsWith('/') &&
  !x.includes('\\') && !x.includes(':') &&
  x.split('/').every(p => p && p !== '.' && p !== '..');

// Les sources référencées doivent aussi être examinées humainement : ce contrôle
// structurel ne démontre jamais la véracité d'un texte ou d'une coordonnée.
export function validerHistorique(base) {
  const erreurs = [];
  if (!base || base.schemaVersion !== 1 || !Array.isArray(base.sources) ||
      !Array.isArray(base.lieux)) return ['Structure canonique invalide'];
  const sources = new Map();
  for (const s of base.sources) {
    if (!s || !present(s.id) || sources.has(s.id) || !present(s.titre) ||
        !local(s.fichier) || !present(s.repere)) erreurs.push('Source locale invalide ou dupliquée');
    else sources.set(s.id, s);
  }
  const preuve = refs => Array.isArray(refs) && refs.length > 0 &&
    refs.every(id => sources.has(id));
  const ids = new Set();
  for (const lieu of base.lieux) {
    if (!lieu || !present(lieu.id) || ids.has(lieu.id) || !present(lieu.nom) ||
        !Array.isArray(lieu.faits)) { erreurs.push('Lieu invalide ou dupliqué'); continue; }
    ids.add(lieu.id);
    const gps = lieu.localisation;
    if (!gps || !statuts.includes(gps.certitude) ||
        (gps.certitude === 'à vérifier' && (gps.latitude !== null || gps.longitude !== null)) ||
        (gps.certitude === 'attesté' && (!Number.isFinite(gps.latitude) ||
          Math.abs(gps.latitude) > 90 || !Number.isFinite(gps.longitude) ||
          Math.abs(gps.longitude) > 180 || !preuve(gps.sources)))) erreurs.push('Localisation invalide : ' + lieu.id);
    const faits = new Set();
    for (const f of lieu.faits) {
      if (!f || !present(f.id) || faits.has(f.id) || !present(f.texte) ||
          !['attesté', 'plausible', 'à vérifier'].includes(f.certitude) || !f.date || !statuts.includes(f.date.certitude) ||
          (f.date.certitude === 'à vérifier' && f.date.libelle !== 'à vérifier') ||
          (f.date.certitude === 'attesté' && (!present(f.date.libelle) ||
            f.date.libelle === 'à vérifier' || !preuve(f.date.sources))) ||
          (['attesté', 'plausible'].includes(f.certitude) && !preuve(f.sources))) erreurs.push('Fait ou date invalide : ' + lieu.id);
      if (f) faits.add(f.id);
    }
  }
  return erreurs;
}

// Transcription dérivée uniquement : aucun récit concurrent, paraphrase,
// synthèse vocale, durée estimée ou déclenchement GPS dans ce premier socle.
export function preparerAudioguide(base, lieuId) {
  if (validerHistorique(base).length) return { statut: 'à vérifier', transcription: null, faits: [] };
  const lieu = base.lieux.find(l => l.id === lieuId);
  const faits = lieu?.localisation.certitude === 'attesté'
    ? lieu.faits.filter(f => f.certitude === 'attesté' && f.date.certitude === 'attesté') : [];
  return faits.length ? {
    statut: 'transcription prête', transcription: faits.map(f => f.texte).join('\n\n'),
    faits: faits.map(f => ({ id: f.id, sources: [...f.sources], dateSources: [...f.date.sources] }))
  } : { statut: 'à vérifier', transcription: null, faits: [] };
}
