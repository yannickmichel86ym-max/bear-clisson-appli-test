/* Catalogue éditorial canonique des propositions, distinct de la trace GPS.
   null = inconnu, jamais zéro. Aucune catégorie n'est liée à parcours.json.
   Ajouter une source et valider le terrain avant toute future activation. */
export const catalogue = Object.freeze({
  schemaVersion: 1,
  source: 'MISSION_MAITRE.md — axe B (noms proposés uniquement)',
  adventures: Object.freeze([
    ['petite-patte', 'Petite Patte'],
    ['ours-curieux', 'Ours Curieux'],
    ['traces-ours', "Sur les traces de l’Ours"],
    ['grande-grizzly', 'Grande Grizzly']
  ].map(([id, name]) => Object.freeze({
    id, name, status: 'draft', routeId: null,
    durationMinutes: null, distanceMeters: null,
    start: null, finish: null, geometry: null,
    accessibility: null, history: null, businesses: null,
    sources: Object.freeze([]), fieldValidation: null
  })))
});

// Barrière volontaire : le catalogue de ce prototype ne lance aucun guidage.
export function selectionMessage(id) {
  const adventure = catalogue.adventures.find(item => item.id === id);
  return adventure
    ? `${adventure.name} : choix provisoire pour cet aperçu. Parcours à préparer ; aucun guidage lancé. Ce choix n’est pas enregistré.`
    : 'Choisis une aventure pour en préparer la suite. Aucun guidage ne sera lancé.';
}
