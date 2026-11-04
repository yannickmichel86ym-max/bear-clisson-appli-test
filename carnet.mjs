import {historique, validerHistorique} from './histoire-canonique.mjs';
// Aucun point réel activé sans source et vérification du lieu.
export const observation = Object.freeze({id: 'trois-formes', target: null});

export function proximityStatus(target, fix, now = Date.now()) {
  const validPoint = p => p && Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 &&
    Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180;
  if (!validPoint(target) || target.verified !== true ||
      typeof target.source !== 'string' || !target.source.trim()) return 'à vérifier';
  if (!validPoint(fix) || !Number.isFinite(now) || !Number.isFinite(fix.timestamp) ||
      fix.timestamp > now || now - fix.timestamp > 15000 ||
      !Number.isFinite(fix.accuracy) || fix.accuracy <= 0 || fix.accuracy > 25) return 'incertaine';
  const rad = x => x * Math.PI / 180;
  const h = Math.sin(rad(fix.latitude - target.latitude) / 2) ** 2 +
    Math.cos(rad(target.latitude)) * Math.cos(rad(fix.latitude)) *
    Math.sin(rad(fix.longitude - target.longitude) / 2) ** 2;
  const distance = 12742000 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
  // L’incertitude entière doit tenir dans le rayon de 50 m.
  return distance + fix.accuracy <= 50 ? 'proximité confirmée' : 'incertaine';
}

// Le choix manuel ne requiert aucune coordonnée ni photographie.
export function storyCards(base = historique) {
 if (validerHistorique(base).length) return [];
 return base.lieux.flatMap(lieu => {
  const facts = lieu.faits.filter(f => f.certitude === 'attesté' && f.date.certitude === 'attesté');
  if (!facts.length) return [];
  const refs = new Set(facts.flatMap(f => [...f.sources, ...f.date.sources]));
  return [{id:lieu.id, title:lieu.nom, text:facts.map(f=>f.texte).join('\n\n'),
   period:[...new Set(facts.map(f=>f.date.libelle))].join(' · '),
   sources:base.sources.filter(s=>refs.has(s.id)).map(s=>s.titre+' — '+s.repere).join(' ; ')}];
 });
}
export function mountCarnet(doc, win = window, cards = storyCards()) {
 const el = id => doc.getElementById(id);
 if (!el('monument-choice')) return;
 let photo = null, speaking = null;
 const stop = () => { if (speaking) win.speechSynthesis?.cancel(); speaking = null; el('story-stop').disabled = true; };
 for (const card of cards) {
  const option = doc.createElement('option'); option.value = card.id; option.textContent = card.title; el('monument-choice').append(option);
 }
 el('monument-choice').disabled = !cards.length;
 el('story-empty').hidden = !!cards.length;
 const selected = () => cards.find(c => c.id === el('monument-choice').value);
 el('monument-choice').onchange = () => {
  stop(); const card = selected(); el('story-card').hidden = !card;
  el('story-text').textContent = card?.text || '';
  el('story-source').textContent = card ? 'Période : '+card.period+' · Sources : '+card.sources : '';
  el('story-play').disabled = !card || !win.speechSynthesis || !win.SpeechSynthesisUtterance;
 };
 el('story-play').onclick = () => {
  const card = selected(); if (!card || !win.speechSynthesis || !win.SpeechSynthesisUtterance) return;
  stop(); const utterance = new win.SpeechSynthesisUtterance(card.text); utterance.lang = 'fr-FR'; speaking = utterance;
  utterance.onend = utterance.onerror = () => { if (speaking === utterance) { speaking = null; el('story-stop').disabled = true; } };
  el('story-stop').disabled = false; try { win.speechSynthesis.speak(utterance); } catch { stop(); el('story-voice-note').textContent = 'Lecture indisponible. Tu peux lire le récit ci-dessus.'; }
 };
 el('story-stop').onclick = stop;
 // Annonce à la page (carnet-souvenirs.mjs) la photo choisie ; ce module ne stocke rien lui-même.
 const announce = file => { if (doc.dispatchEvent && win.CustomEvent) doc.dispatchEvent(new win.CustomEvent('carnet:photo', {detail: {file}})); };
 const clear = () => { if (photo) win.URL.revokeObjectURL(photo); photo = null; el('photo-preview').removeAttribute('src'); el('photo-draft').hidden = true; el('rallye-photo').value = ''; announce(null); };
 el('photo-remove').onclick = () => { clear(); el('photo-feedback').textContent = 'Photo effacée du carnet.'; };
 el('rallye-photo').onchange = () => {
  const file = el('rallye-photo').files[0]; clear(); if (!file) return;
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.size > 20*1024*1024) {
   el('photo-feedback').textContent = 'Choisis une photo de moins de 20 Mo. Tu peux aussi continuer sans photo.'; return;
  }
  photo = win.URL.createObjectURL(file); el('photo-preview').src = photo; el('photo-draft').hidden = false;
  el('photo-feedback').textContent = 'Photo gardée dans cet onglet. À toi de choisir le monument, puis de la garder dans ton carnet si tu le souhaites.';
  announce(file);
 };
 el('photo-preview').onerror = () => { clear(); el('photo-feedback').textContent = 'Photo illisible ici. Essaie un JPEG ou continue sans photo.'; };
 el('story-voice-note').textContent = win.speechSynthesis && win.SpeechSynthesisUtterance ? 'Lecture par la voix du navigateur, selon les voix disponibles sur cet appareil.' : 'Lecture vocale indisponible sur ce navigateur. Le récit reste lisible.';
 doc.addEventListener('carnet:souvenir-saved', () => { clear(); el('photo-feedback').textContent = 'Photo gardée dans ton carnet, sur cet appareil.'; });
 el('rallye')?.addEventListener('close', stop);
 doc.addEventListener('visibilitychange', () => { if (doc.hidden) stop(); });
 win.addEventListener('pagehide', () => { stop(); clear(); });
}
if (typeof document !== 'undefined') mountCarnet(document, window);
