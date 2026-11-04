// Canon préparatoire uniquement : aucun commerce ni partenariat réel enregistré.
export const partenaires = Object.freeze({
  schemaVersion: 1, sources: Object.freeze([]),
  commerces: Object.freeze([]), offres: Object.freeze([])
});
const inconnu = () => ({valeur: 'à vérifier', statut: 'à vérifier', sources: []});
export function creerBrouillonCommerce(id) {
  return {id, statut: 'brouillon', nom: inconnu(), adresse: inconnu(),
    horaires: inconnu(), savoirFaire: inconnu(),
    localisation: {statut: 'à vérifier', latitude: null, longitude: null, sources: []},
    lieuHistoriqueId: null};
}
export function creerBrouillonOffre(id, commerceId) {
  return {id, commerceId, statut: 'brouillon', intitule: inconnu(),
    conditions: inconnu(), validite: inconnu(), accordCommercant: inconnu()};
}
const objet = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const exact = (x, keys) => objet(x) && Object.keys(x).length === keys.length &&
  keys.every(k => Object.hasOwn(x, k));
const texte = x => typeof x === 'string' && x.trim().length > 0;
const identifiant = x => typeof x === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(x);
const cheminLocal = x => texte(x) && !/[\\:#?%\s]/.test(x) &&
  x.split('/').every(p => p && p !== '.' && p !== '..');

// Validation structurelle, sans lecture de fichier, réseau, publication ou suivi.
// Une référence déclarée ne constitue pas une preuve examinée.
export function validerPartenaires(base) {
  const erreurs = [];
  if (!exact(base, ['schemaVersion', 'sources', 'commerces', 'offres']) ||
      base.schemaVersion !== 1 || !['sources', 'commerces', 'offres'].every(k => Array.isArray(base[k])))
    return ['Structure partenaires invalide'];
  const sources = new Set();
  for (const s of base.sources) {
    if (!exact(s, ['id', 'titre', 'fichier', 'repere']) || !identifiant(s.id) ||
        sources.has(s.id) || !texte(s.titre) || !cheminLocal(s.fichier) || !texte(s.repere))
      erreurs.push('Source locale invalide ou dupliquée');
    else sources.add(s.id);
  }
  const refs = x => Array.isArray(x) && new Set(x).size === x.length && x.every(id => sources.has(id));
  const information = x => exact(x, ['valeur', 'statut', 'sources']) && refs(x.sources) &&
    ((x.statut === 'à vérifier' && x.valeur === 'à vérifier' && x.sources.length === 0) ||
     (x.statut === 'vérifié' && texte(x.valeur) && x.valeur !== 'à vérifier' && x.sources.length > 0));
  const commerces = new Set();
  for (const c of base.commerces) {
    if (!exact(c, ['id', 'statut', 'nom', 'adresse', 'horaires', 'savoirFaire', 'localisation', 'lieuHistoriqueId']) ||
        !identifiant(c.id) || commerces.has(c.id) || !['brouillon', 'confirmé'].includes(c.statut) ||
        !['nom', 'adresse', 'horaires', 'savoirFaire'].every(k => information(c[k])) ||
        !(c.lieuHistoriqueId === null || identifiant(c.lieuHistoriqueId))) {
      erreurs.push('Brouillon commerce invalide ou dupliqué'); continue;
    }
    if (c.statut === 'confirmé' && c.nom.statut !== 'vérifié') erreurs.push('Nom confirmé sans preuve');
    commerces.add(c.id);
    const g = c.localisation;
    if (!exact(g, ['statut', 'latitude', 'longitude', 'sources']) || !refs(g.sources) ||
        !((g.statut === 'à vérifier' && g.latitude === null && g.longitude === null && g.sources.length === 0) ||
          (g.statut === 'vérifié' && Number.isFinite(g.latitude) && Math.abs(g.latitude) <= 90 &&
           Number.isFinite(g.longitude) && Math.abs(g.longitude) <= 180 && g.sources.length > 0)))
      erreurs.push('GPS commerce invalide');
  }
  const offres = new Set();
  for (const o of base.offres) {
    if (!exact(o, ['id', 'commerceId', 'statut', 'intitule', 'conditions', 'validite', 'accordCommercant']) ||
        !identifiant(o.id) || offres.has(o.id) || !commerces.has(o.commerceId) || !['brouillon', 'confirmé'].includes(o.statut) ||
        !['intitule', 'conditions', 'validite', 'accordCommercant'].every(k => information(o[k])))
      erreurs.push('Brouillon offre invalide, dupliqué ou sans commerce');
    if (o?.statut === 'confirmé' && !['intitule', 'conditions', 'validite', 'accordCommercant'].every(k => o[k]?.statut === 'vérifié')) erreurs.push('Offre confirmée sans preuve');
    if (objet(o)) offres.add(o.id);
  }
  return erreurs;
}
