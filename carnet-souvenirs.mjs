// Carnet de l'Ours V12 : souvenirs choisis volontairement, gardés sur cet appareil seulement.
// Aucun envoi réseau, aucune analyse d'image, aucune position GPS : légende, photo originale
// facultative, date d'enregistrement et monument choisi à la main parmi des fiches sourcées.
export const LIMITS = Object.freeze({legend: 280, photoBytes: 20 * 1024 * 1024, count: 60});
export const DB_NAME = 'bear-carnet-ours', STORE = 'souvenirs', DB_VERSION = 1;
const DISPLAYABLE = /^image\/(?:jpeg|png|webp|gif|heic|heif|avif)$/;

export const MESSAGES = Object.freeze({
 unavailable: 'Carnet indisponible sur ce navigateur (navigation privée ou stockage bloqué). Ta photo reste dans cet onglet jusqu’au rechargement.',
 quota: 'Plus assez de place sur cet appareil : rien n’a été enregistré. Exporte ou supprime des souvenirs, puis réessaie.',
 full: 'Le carnet contient déjà ' + LIMITS.count + ' souvenirs. Exporte-le puis supprime des souvenirs pour en garder d’autres.',
 empty: 'Écris une légende ou choisis une photo avant de garder un souvenir.',
 legend: 'Légende trop longue : ' + LIMITS.legend + ' caractères au maximum.',
 photo: 'Photo refusée : choisis une image (JPEG, PNG, HEIC…) de moins de 20 Mo.',
 write: 'Enregistrement interrompu : rien n’a été gardé. Ta photo reste disponible, réessaie.',
 read: 'Lecture du carnet impossible pour le moment. Aucun souvenir n’a été effacé.',
});

export class CarnetError extends Error {
 constructor(code) { super(MESSAGES[code] || MESSAGES.write); this.code = code; }
}
export const errorCode = error => error instanceof CarnetError ? error.code :
 error?.name === 'QuotaExceededError' ? 'quota' : 'write';

export function normalizeLegend(text) {
 return String(text ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
}

// Construit l'enregistrement : la photo est gardée telle quelle (mêmes octets, type et nom).
export function buildSouvenir({legend, photo = null, monument = null, now, id}) {
 const text = normalizeLegend(legend);
 if ([...text].length > LIMITS.legend) throw new CarnetError('legend');
 if (photo && (typeof photo.type !== 'string' || !photo.type.startsWith('image/') || photo.type === 'image/svg+xml' ||
  !Number.isFinite(photo.size) || photo.size <= 0 || photo.size > LIMITS.photoBytes)) throw new CarnetError('photo');
 if (!text && !photo) throw new CarnetError('empty');
 if (!Number.isFinite(now) || typeof id !== 'string' || !id) throw new CarnetError('write');
 const chosen = monument && typeof monument.id === 'string' && monument.id && typeof monument.title === 'string' ?
  {id: monument.id, title: monument.title} : null;
 return {id, savedAt: now, legend: text, monument: chosen,
  photo: photo ? {blob: photo, name: typeof photo.name === 'string' ? photo.name : '', type: photo.type, size: photo.size} : null};
}

function request(db, mode, run) {
 return new Promise((resolve, reject) => {
  let tx, req;
  try { tx = db.transaction(STORE, mode); req = run(tx.objectStore(STORE)); }
  catch (error) { reject(new CarnetError(errorCode(error))); return; }
  // Résolution seulement à la validation complète : pas de souvenir à moitié écrit.
  tx.oncomplete = () => resolve(req?.result);
  tx.onabort = tx.onerror = () => reject(new CarnetError(errorCode(tx.error || req?.error)));
 });
}

export function openIdbStore(factory) {
 return new Promise((resolve, reject) => {
  let req;
  try { req = factory?.open(DB_NAME, DB_VERSION); } catch { req = null; }
  if (!req) { reject(new CarnetError('unavailable')); return; }
  req.onupgradeneeded = () => {
   const db = req.result;
   if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, {keyPath: 'id'});
  };
  req.onsuccess = () => {
   const db = req.result;
   db.onversionchange = () => db.close();
   resolve({
    add: record => request(db, 'readwrite', s => s.add(record)),
    list: () => request(db, 'readonly', s => s.getAll()).then(all => all || []),
    remove: id => request(db, 'readwrite', s => s.delete(id)),
    clear: () => request(db, 'readwrite', s => s.clear()),
   });
  };
  req.onerror = req.onblocked = () => reject(new CarnetError('unavailable'));
 });
}

export const escapeHtml = value => String(value).replace(/[&<>"']/g,
 c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);

export async function toBase64(blob) {
 const bytes = new Uint8Array(await blob.arrayBuffer());
 let binary = '';
 for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
 return btoa(binary);
}

export const formatDate = ms => new Date(ms).toLocaleString('fr-FR', {dateStyle: 'long', timeStyle: 'short'});
export const formatBytes = n => n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + ' ko' :
 n < 1024 ** 3 ? (n / 1024 / 1024).toLocaleString('fr-FR', {maximumFractionDigits: 1}) + ' Mo' :
 (n / 1024 ** 3).toLocaleString('fr-FR', {maximumFractionDigits: 1}) + ' Go';
export const exportName = now => 'carnet-de-l-ours-' + new Date(now).toISOString().slice(0, 10) + '.html';
export function photoName(souvenir) {
 const name = souvenir.photo?.name || '';
 if (/^[\w. ()-]{1,120}$/.test(name) && !name.startsWith('.')) return name;
 const ext = (souvenir.photo?.type.split('/')[1] || 'img').replace(/[^a-z0-9]/g, '').slice(0, 5) || 'img';
 return 'souvenir-' + new Date(souvenir.savedAt).toISOString().slice(0, 10) + '.' + ext;
}

// Fichier HTML autonome et inerte (CSP sans script ni réseau) : légendes échappées, photos originales intégrées.
export async function exportParts(souvenirs, now) {
 const parts = ['<!doctype html>\n<html lang="fr"><head><meta charset="utf-8">',
  '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'">',
  '<meta name="viewport" content="width=device-width, initial-scale=1"><title>Carnet de l’Ours</title>',
  '<style>body{font:16px/1.6 system-ui,sans-serif;max-width:760px;margin:auto;padding:20px;color:#2F2A26;background:#FFF9F3}',
  'article{border-top:1px solid #2F2A26;padding:16px 0}img{display:block;max-width:100%;height:auto;border-radius:12px}',
  '.meta{font-size:13px}p.legend{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body>',
  '<h1>Carnet de l’Ours · BEAR is BacK</h1><p class="meta">Exporté le ', escapeHtml(formatDate(now)), ' · ',
  String(souvenirs.length), ' souvenir(s). Fichier créé sur ton appareil, sans envoi. Les photos sont les originaux.</p>'];
 for (const s of souvenirs) {
  parts.push('<article>');
  if (s.photo?.blob) {
   const type = DISPLAYABLE.test(s.photo.type) ? s.photo.type : 'application/octet-stream';
   parts.push('<img alt="', escapeHtml(s.legend ? 'Photo : ' + s.legend : 'Photo du souvenir'), '" src="data:', type, ';base64,',
    await toBase64(s.photo.blob), '"><p class="meta">Photo originale : ', escapeHtml(photoName(s)), ' · ',
    escapeHtml(formatBytes(s.photo.size)), '. Si elle ne s’affiche pas ici, ce navigateur ne lit pas ce format.</p>');
  }
  if (s.legend) parts.push('<p class="legend">', escapeHtml(s.legend), '</p>');
  parts.push('<p class="meta">Gardé le ', escapeHtml(formatDate(s.savedAt)),
   s.monument ? ' · Monument choisi à la main : ' + escapeHtml(s.monument.title) : '', '</p></article>');
 }
 parts.push('</body></html>\n');
 return parts;
}

export function mountSouvenirs(doc, win = window, openStore = () => openIdbStore(win.indexedDB)) {
 const el = id => doc.getElementById(id);
 if (!el('souvenir-save')) return null;
 let store = null, items = [], urls = [], photo = null, busy = false;
 const status = text => { el('souvenir-status').textContent = text; };
 const sync = () => {
  el('souvenir-save').disabled = busy || !store;
  el('souvenir-export').disabled = busy || !store || !items.length;
  el('souvenir-clear').disabled = busy || !store || !items.length;
  el('souvenir-count').textContent = [...normalizeLegend(el('souvenir-legend').value)].length + ' / ' + LIMITS.legend;
  el('souvenir-photo-note').textContent = photo ? 'La photo choisie sera gardée avec ce souvenir, telle quelle.' : 'Aucune photo : le souvenir sera gardé avec sa légende seule.';
 };
 const revoke = () => { for (const url of urls) win.URL.revokeObjectURL(url); urls = []; };
 const download = (blob, name) => {
  const url = win.URL.createObjectURL(blob), a = doc.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener'; doc.body.append(a); a.click(); a.remove();
  win.setTimeout(() => win.URL.revokeObjectURL(url), 60000);
 };
 const usage = async () => {
  try {
   const e = await win.navigator?.storage?.estimate?.();
   el('souvenir-usage').textContent = e && Number.isFinite(e.usage) && Number.isFinite(e.quota) && e.quota > 0 ?
    'Espace utilisé par l’application sur cet appareil : ' + formatBytes(e.usage) + ' sur environ ' + formatBytes(e.quota) + ' permis (estimation du navigateur).' :
    'Espace disponible non communiqué par ce navigateur.';
  } catch { el('souvenir-usage').textContent = 'Espace disponible non communiqué par ce navigateur.'; }
 };
 function render() {
  revoke();
  const list = el('souvenir-list'); list.replaceChildren();
  for (const s of items) {
   const li = doc.createElement('li'); li.className = 'souvenir';
   const add = (tag, text, cls) => { const n = doc.createElement(tag); n.textContent = text; if (cls) n.className = cls; li.append(n); return n; };
   const when = formatDate(s.savedAt);
   if (s.photo?.blob) {
    const img = doc.createElement('img'), url = win.URL.createObjectURL(s.photo.blob); urls.push(url);
    img.src = url; img.alt = s.legend ? 'Photo : ' + s.legend : 'Photo du souvenir du ' + when; img.loading = 'lazy'; li.append(img);
    img.onerror = () => { img.hidden = true; };
   }
   if (s.legend) add('p', s.legend, 'souvenir-legend-text');
   add('p', 'Gardé le ' + when + (s.monument ? ' · Monument choisi : ' + s.monument.title : '') +
    (s.photo ? ' · Photo originale ' + formatBytes(s.photo.size) : ''), 'rallye-note');
   const actions = doc.createElement('div'); actions.className = 'souvenir-actions'; li.append(actions);
   const button = (text, label, run) => { const b = doc.createElement('button'); b.type = 'button'; b.textContent = text; b.setAttribute('aria-label', label); b.onclick = run; actions.append(b); return b; };
   if (s.photo?.blob) button('Télécharger la photo', 'Télécharger la photo originale du souvenir du ' + when, () => {
    download(s.photo.blob, photoName(s)); status('Photo originale préparée au téléchargement, sans envoi.');
   });
   button('Supprimer', 'Supprimer le souvenir du ' + when, async () => {
    if (busy || !win.confirm('Supprimer définitivement ce souvenir de cet appareil ? Pense à exporter ton carnet avant.')) return;
    await act(() => store.remove(s.id), 'Souvenir supprimé de cet appareil.');
   });
   list.append(li);
  }
  el('souvenir-empty').hidden = items.length > 0;
  sync();
 }
 async function refresh() {
  try { items = (await store.list()).sort((a, b) => b.savedAt - a.savedAt); }
  catch { status(MESSAGES.read); }
  render(); usage();
 }
 async function act(run, done) {
  busy = true; sync();
  try { await run(); status(done); } catch (error) { status(MESSAGES[errorCode(error)]); }
  finally { busy = false; }
  await refresh();
 }
 const chosenMonument = () => {
  const select = el('monument-choice');
  return select?.value ? {id: select.value, title: select.selectedOptions?.[0]?.textContent || select.value} : null;
 };
 el('souvenir-legend').oninput = sync;
 doc.addEventListener('carnet:photo', event => { photo = event.detail?.file || null; sync(); });
 el('souvenir-save').onclick = async () => {
  if (busy) return;
  if (!store) { status(MESSAGES.unavailable); return; }
  if (items.length >= LIMITS.count) { status(MESSAGES.full); return; }
  let record;
  try {
   record = buildSouvenir({legend: el('souvenir-legend').value, photo, monument: chosenMonument(), now: Date.now(),
    id: win.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2)});
  } catch (error) { status(MESSAGES[errorCode(error)]); return; }
  busy = true; sync();
  try {
   await store.add(record);
   el('souvenir-legend').value = ''; photo = null;
   if (doc.dispatchEvent && win.CustomEvent) doc.dispatchEvent(new win.CustomEvent('carnet:souvenir-saved'));
   status('Souvenir gardé sur cet appareil. Rien n’a été envoyé.');
  } catch (error) { status(MESSAGES[errorCode(error)]); }
  finally { busy = false; }
  await refresh();
 };
 el('souvenir-export').onclick = async () => {
  if (busy || !items.length) return;
  busy = true; sync(); status('Préparation du fichier…');
  try {
   const now = Date.now(), name = exportName(now);
   download(new win.Blob(await exportParts(items, now), {type: 'text/html'}), name);
   status('Fichier « ' + name + ' » préparé : ' + items.length + ' souvenir(s). Il reste sur ton appareil ; à toi de le ranger ou de le partager.');
  } catch { status('Export impossible (mémoire insuffisante ?). Tes souvenirs restent dans le carnet ; télécharge les photos une à une.'); }
  finally { busy = false; sync(); }
 };
 el('souvenir-clear').onclick = async () => {
  if (busy || !items.length || !win.confirm('Effacer définitivement les ' + items.length + ' souvenirs de cet appareil ? Exporte ton carnet avant si tu veux les garder.')) return;
  await act(() => store.clear(), 'Carnet vidé : tous les souvenirs ont été effacés de cet appareil.');
 };
 win.addEventListener('pagehide', revoke);
 sync();
 return Promise.resolve().then(openStore).then(async opened => { store = opened; await refresh(); },
  () => { store = null; status(MESSAGES.unavailable); el('souvenir-empty').hidden = false; sync(); });
}
if (typeof document !== 'undefined') mountSouvenirs(document, window);
