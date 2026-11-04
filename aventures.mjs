import { catalogue, selectionMessage } from './adventure-catalogue.mjs';

export function mountAdventures(doc) {
  const cards = doc.getElementById('adventure-cards');
  const status = doc.getElementById('adventure-status');
  const fragment = doc.createDocumentFragment();
  for (const adventure of catalogue.adventures) {
    const label = doc.createElement('label');
    label.className = 'adventure-card';
    const radio = doc.createElement('input');
    radio.type = 'radio';
    radio.name = 'adventure';
    radio.value = adventure.id;
    const name = doc.createElement('strong');
    name.textContent = adventure.name;
    const details = doc.createElement('span');
    details.textContent = 'À préparer · Durée, distance, départ, arrivée et GPS : à vérifier. Accessibilité, histoire et commerces : à vérifier. Parcours indisponible.';
    radio.addEventListener('change', () => {
      if (radio.checked) status.textContent = selectionMessage(radio.value);
    });
    label.append(radio, name, details);
    fragment.append(label);
  }
  cards.replaceChildren(fragment);
}

if (typeof document !== 'undefined') mountAdventures(document);
