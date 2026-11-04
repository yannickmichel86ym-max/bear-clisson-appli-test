import { historique, validerHistorique } from './histoire-canonique.mjs';

// Projection de la seule base canonique : pas de dates numériques dérivées,
// pas de classement chronologique supposé, ni de catalogue historique parallèle.
export function preparerTimeline(base) {
  if (validerHistorique(base).length) return { statut: 'invalide', lieux: [] };
  return { statut: base.lieux.length ? 'prêt' : 'vide', lieux: base.lieux.map(l => ({
    id: l.id, nom: l.nom,
    gps: l.localisation.certitude === 'attesté' ? 'attesté' : 'inconnu · à vérifier',
    reperes: l.faits.map(f => ({
      texte: f.texte,
      certitude: f.certitude === 'à vérifier' ? 'inconnu · à vérifier' : f.certitude,
      date: f.date.certitude === 'attesté' ? f.date.libelle : 'à vérifier',
      dateCertitude: f.date.certitude === 'attesté' ? 'attesté' : 'inconnu',
      sources: [...new Set([...(f.sources || []), ...(f.date.sources || [])])]
        .map(id => base.sources.find(s => s.id === id)).filter(Boolean)
        .map(s => `${s.titre} — ${s.fichier} — ${s.repere}`)
    }))
  })) };
}

export function mountTimeline(doc, base = historique) {
  const root = doc.getElementById('timeline-content');
  const model = preparerTimeline(base);
  const el = (tag, text) => {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  root.replaceChildren();
  if (model.statut !== 'prêt') {
    root.append(el('p', model.statut === 'vide'
      ? 'Aucun lieu historiquement documenté disponible dans l’atelier. Sources, dates, GPS et commerces : à vérifier. Aucun événement inventé.'
      : 'Dossier historique invalide : à vérifier. Aucun événement affiché.'));
    return;
  }
  const label = el('label', 'Lieu documenté ');
  const select = el('select');
  label.append(select);
  const view = el('section');
  view.setAttribute('aria-live', 'polite');
  model.lieux.forEach((lieu, i) => {
    const option = el('option', lieu.nom); option.value = String(i); select.append(option);
  });
  function show(index) {
    const lieu = model.lieux[index];
    view.replaceChildren(el('h2', lieu.nom), el('p', `GPS : ${lieu.gps}`));
    if (!lieu.reperes.length) view.append(el('p', 'Histoire et dates : inconnu · à vérifier.'));
    const list = el('ol');
    for (const r of lieu.reperes) {
      const item = el('li');
      const details = el('details');
      details.append(el('summary', `${r.date} · ${r.certitude}`),
        el('p', r.texte), el('p', `Date : ${r.dateCertitude} · ${r.date}`),
        el('p', `Sources du fait ou de sa date : ${r.sources.join(' ; ') || 'à vérifier'}`));
      item.append(details); list.append(item);
    }
    view.append(list);
  }
  select.addEventListener('change', () => show(Number(select.value)));
  root.append(label, view); show(0);
}
if (typeof document !== 'undefined') mountTimeline(document);
