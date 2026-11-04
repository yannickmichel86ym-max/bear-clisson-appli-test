import {proximityStatus} from './carnet.mjs';

// Source canonique des futures fiches attestées. L’inventaire local est vide.
// Une entrée exige id/title/challenge/story/storySource, target {latitude,
// longitude, verified:true, source}, provenance et arrêt sûr vérifiés.
export const culturalStages = Object.freeze([]);
export function isActivatedStage(stage) {
 const text = value => typeof value === 'string' && value.trim().length > 0 && !/à vérifier/i.test(value);
 return !!stage && ['id','title','challenge','story','storySource'].every(key => text(stage[key])) &&
  ['photo-géolocalisée-vérifiée','source-cartographique-autorisée'].includes(stage.provenance) &&
  stage.safeStopVerified === true && text(stage.target?.source) &&
  proximityStatus(stage.target, null) !== 'à vérifier';
}
export function canValidateStage(stage, fix, now, demo = false) {
 return !demo && isActivatedStage(stage) && proximityStatus(stage.target, fix, now) === 'proximité confirmée';
}

export function mountRallye(doc, win) {
 const el = id => doc.getElementById(id), dialog = el('rallye');
 if (!dialog) return;
 let timer = null;
 const validated = new Set();
 const status = text => { el('rallye-status').textContent = text; };
 el('rallye-open').onclick = () => { dialog.showModal(); refreshStages(); timer = win.setInterval(refreshStages, 1000); };
 el('rallye-close').onclick = () => dialog.close();
 dialog.addEventListener('close', () => { win.clearInterval(timer); timer = null; el('rallye-open').focus(); });
 const stages = culturalStages.filter(isActivatedStage), controls = [];
 for (const stage of stages) {
  const card = doc.createElement('article'); card.className = 'culture-card';
  const add = (tag, text) => { const node = doc.createElement(tag); node.textContent = text; card.append(node); return node; };
  add('h3', stage.title); add('p', stage.challenge); add('p', stage.story);
  add('p', 'Sources : ' + stage.storySource + ' · Position : ' + stage.target.source);
  const safety = doc.createElement('input'); safety.type = 'checkbox';
  const label = add('label', ' Je suis arrêté en sécurité.'); label.prepend(safety);
  const info = add('p', 'GPS réel récent requis. Photo facultative.'); info.setAttribute('role','status');
  const button = add('button', 'Valider cette étape'); button.type = 'button'; button.disabled = true;
  button.onclick = () => {
   if (!safety.checked || doc.hidden || !canValidateStage(stage, win.bearRallyeFix?.(), Date.now())) return;
   validated.add(stage.id); status(validated.size + ' étape(s) culturelle(s) validée(s) par proximité GPS.'); refreshStages();
  };
  el('culture-stages').append(card); controls.push({stage,safety,info,button});
 }
 function refreshStages() {
  for (const {stage,safety,info,button} of controls) {
   const fix = doc.hidden ? null : win.bearRallyeFix?.();
   const confirmed = canValidateStage(stage, fix, Date.now());
   button.disabled = validated.has(stage.id) || !safety.checked || !confirmed;
   info.textContent = validated.has(stage.id) ? 'Étape validée pendant cette session.' : confirmed ? 'Proximité confirmée · arrête-toi en sécurité avant de valider.' : 'Proximité incertaine · GPS réel récent, précision ≤ 25 m, marge incluse dans 50 m. Ne te déplace pas pour améliorer le signal.';
  }
 }
 if (stages.length) {
  el('rallye-availability').textContent = stages.length + ' étape(s) attestée(s) disponible(s).';

 }
 doc.addEventListener('visibilitychange', refreshStages);

}
if (typeof document !== 'undefined') mountRallye(document, window);
