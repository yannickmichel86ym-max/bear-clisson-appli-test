import {partenaires} from './commerces-partenaires.mjs';
// La publication exige une validation éditoriale explicite, distincte des brouillons.
// Les sources doivent être examinées avant de renseigner ce statut dans le canon.
export function offresDisponibles(base, maintenant = new Date()) {
 const instant = maintenant.getTime();
 if (!Number.isFinite(instant)) return [];
 const refs = value => Array.isArray(value) && value.length > 0 && value.every(id =>
  base.sources?.some(s => s.id === id && s.fichier && s.repere));
 const verifie = info => info?.statut === 'vérifié' && typeof info.valeur === 'string' &&
  info.valeur.trim() && info.valeur !== 'à vérifier' && refs(info.sources);
 return (base.offres || []).flatMap(offre => {
  const commerce = base.commerces?.find(c => c.id === offre.commerceId);
  if (offre.statut !== 'confirmé' || commerce?.statut !== 'confirmé' ||
      !verifie(commerce.nom) || !['intitule','conditions','accordCommercant','validite'].every(k => verifie(offre[k]))) return [];
  // Période ISO explicite avec fuseau : aucune interprétation d’une date inconnue.
  const dates = offre.validite.valeur.split('/');
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/;
  if (dates.length !== 2 || !dates.every(d => iso.test(d))) return [];
  const [debut, fin] = dates.map(Date.parse);
  if (!Number.isFinite(debut) || !Number.isFinite(fin) || debut >= fin || instant < debut || instant >= fin) return [];
  return [{offre, commerce, debut, fin}];
 });
}
export function afficherOffres(doc, base, maintenant = new Date()) {
 const liste = doc.getElementById('partner-offers');
 liste.replaceChildren();
 const offres = offresDisponibles(base, maintenant);
 for (const {offre, commerce, debut, fin} of offres) {
  const carte = doc.createElement('article');carte.className = 'partner-card';
  const ajouter = (tag, texte) => {const n = doc.createElement(tag);n.textContent = texte;carte.append(n);};
  ajouter('p', commerce.nom.valeur);ajouter('h3', offre.intitule.valeur);
  ajouter('p', 'Conditions : ' + offre.conditions.valeur);
  const format = d => new Date(d).toLocaleString('fr-FR', {timeZone:'Europe/Paris'});
  ajouter('p', 'Du ' + format(debut) + ' au ' + format(fin) + ' (heure de Paris).');
  liste.append(carte);
 }
 doc.getElementById('partner-empty').hidden = offres.length > 0;
}
if (typeof document !== 'undefined') {
 const actualiser = () => afficherOffres(document, partenaires);
 actualiser();
 document.getElementById('partners').addEventListener('toggle', actualiser);
 document.getElementById('nav-partners').addEventListener('click', actualiser);
 document.addEventListener('visibilitychange', actualiser);
 // Écarter aussi une offre expirant pendant la consultation.
 setInterval(actualiser, 30000);
}
