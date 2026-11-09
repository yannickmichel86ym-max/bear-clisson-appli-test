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

// Photo du monument (V15) : gardée dans cet onglet jusqu’à son enregistrement ou au rechargement.
// Aucune reconnaissance d’image : le monument est celui touché sur la carte.
export function mountCarnet(doc, win = window) {
 const el = id => doc.getElementById(id);
 if (!el('rallye-photo')) return;
 let photo = null;
 // Annonce à la page (carnet-souvenirs.mjs) la photo choisie ; ce module ne stocke rien lui-même.
 const announce = file => { if (doc.dispatchEvent && win.CustomEvent) doc.dispatchEvent(new win.CustomEvent('carnet:photo', {detail: {file}})); };
 const clear = () => { if (photo) win.URL.revokeObjectURL(photo); photo = null; el('photo-preview').removeAttribute('src'); el('photo-draft').hidden = true; el('rallye-photo').value = ''; announce(null); };
 el('photo-remove').onclick = () => { clear(); el('photo-feedback').textContent = 'Photo effacée.'; };
 el('rallye-photo').onchange = () => {
  const file = el('rallye-photo').files[0]; clear(); if (!file) return;
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.size > 20*1024*1024) {
   el('photo-feedback').textContent = 'Choisis une photo de moins de 20 Mo. Tu peux aussi continuer sans photo.'; return;
  }
  photo = win.URL.createObjectURL(file); el('photo-preview').src = photo; el('photo-draft').hidden = false;
  el('photo-feedback').textContent = 'Photo gardée dans cet onglet. Tu peux la garder dans ton carnet avec ce monument.';
  announce(file);
 };
 el('photo-preview').onerror = () => { clear(); el('photo-feedback').textContent = 'Photo illisible ici. Essaie un JPEG ou continue sans photo.'; };
 doc.addEventListener('carnet:souvenir-saved', () => { clear(); el('photo-feedback').textContent = 'Photo gardée dans ton carnet, sur cet appareil.'; });
 win.addEventListener('pagehide', clear);
}
if (typeof document !== 'undefined') mountCarnet(document, window);
