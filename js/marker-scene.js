const markerStatus = document.getElementById('marker-status');
const sceneEl = document.querySelector('a-scene');
const markerEl = document.getElementById('custom-marker');
const spellbook = document.getElementById('spellbook');
const spellbookEffects = document.getElementById('spellbook-effects');
const runeRing = document.getElementById('rune-ring');
const magicMotes = Array.from(document.querySelectorAll('.magic-mote'));
const recipePage = document.getElementById('recipe-page');
const recipeTitle = document.getElementById('recipe-title');
const recipeContent = document.getElementById('recipe-content');
const recipePageSurface = document.querySelector('.tappable-recipe-page');

const recipes = [
  {
    title: 'Fizzing Solution',
    content: 'Vinegar + Baking Soda\\nCH3COOH + NaHCO3\\nCO2 gas + water + sodium acetate'
  },
  {
    title: 'Copper Displacement',
    content: 'Copper Sulfate + Iron\\nCuSO4 + Fe\\nIron displaces copper from solution'
  },
  {
    title: 'Neutralising Draught',
    content: 'Hydrochloric Acid + Sodium Hydroxide\\nHCl + NaOH\\nSalt + water in a neutralisation reaction'
  }
];
let recipeIndex = -1;
let markerIsVisible = false;
let touchStartX = null;
let touchStartY = null;
let ignoreClickUntil = 0;

const ambientAudio = new Audio('assets/audio/ambient-hum.mp3');
ambientAudio.loop = true;
ambientAudio.volume = 0.18;

function showRecipePage(direction = 1) {
  recipeIndex = (recipeIndex + direction + recipes.length) % recipes.length;
  const recipe = recipes[recipeIndex];
  if (recipeTitle) recipeTitle.setAttribute('value', recipe.title);
  if (recipeContent) recipeContent.setAttribute('value', recipe.content);
  if (recipePage) {
    recipePage.setAttribute('visible', 'true');
    recipePage.removeAttribute('animation__turn');
    recipePage.setAttribute('scale', '0.02 1 1');
    recipePage.setAttribute('animation__turn', `property: scale; from: 0.02 1 1; to: 1 1 1; dur: 620; easing: easeInOutCubic`);
  }
  if (markerStatus) markerStatus.textContent = `${direction > 0 ? 'Page turned' : 'Page turned back'} — ${recipe.title}`;
}

AFRAME.registerComponent('click-to-open', {
  init() {
    this.el.addEventListener('click', () => {
      if (Date.now() < ignoreClickUntil) return;
      showRecipePage(1);
    });
  }
});

if (recipePageSurface) {
  recipePageSurface.addEventListener('click', () => {
    if (Date.now() < ignoreClickUntil) return;
    showRecipePage(1);
  });
}

function handleFingerPageTurn(event) {
  if (!markerIsVisible || !recipePage || recipePage.getAttribute('visible') !== true) return;
  const touch = event.changedTouches[0];
  if (!touch || touchStartX === null || touchStartY === null) return;

  const horizontalDistance = touch.clientX - touchStartX;
  const verticalDistance = touch.clientY - touchStartY;
  touchStartX = null;
  touchStartY = null;

  if (Math.abs(horizontalDistance) < 45 || Math.abs(horizontalDistance) < Math.abs(verticalDistance)) return;
  ignoreClickUntil = Date.now() + 700;
  showRecipePage(horizontalDistance < 0 ? 1 : -1);
}

document.addEventListener('touchstart', (event) => {
  if (!markerIsVisible || !event.touches[0]) return;
  touchStartX = event.touches[0].clientX;
  touchStartY = event.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', handleFingerPageTurn, { passive: true });

if (sceneEl && markerEl && spellbook) {
  markerEl.addEventListener('markerFound', () => {
    markerIsVisible = true;
    spellbook.removeAttribute('animation');
    spellbook.removeAttribute('animation__reveal');
    spellbook.setAttribute('scale', '0.001 0.001 0.001');
    spellbook.setAttribute('animation__reveal', 'property: scale; from: 0.001 0.001 0.001; to: 0.15 0.15 0.15; dur: 900; easing: easeOutElastic');
    if (spellbookEffects) spellbookEffects.setAttribute('visible', 'true');
    if (recipePage) recipePage.setAttribute('visible', 'false');
    if (runeRing) runeRing.setAttribute('animation', 'property: rotation; to: -90 360 0; loop: true; dur: 9000; easing: linear');
    magicMotes.forEach((mote, index) => {
      mote.setAttribute('animation__float', `property: position; to: ${index % 2 ? '0.46' : '-0.46'} ${0.35 + index * 0.03} ${index % 2 ? '-0.12' : '0.14'}; dir: alternate; loop: true; dur: ${1800 + index * 160}; easing: easeInOutSine`);
      mote.setAttribute('animation__pulse', `property: scale; from: 0.7 0.7 0.7; to: 1.35 1.35 1.35; dir: alternate; loop: true; dur: ${700 + index * 80}`);
    });
    if (markerStatus) markerStatus.textContent = 'Marker detected — spellbook activated';

    ambientAudio.play().catch(() => {
      console.warn('Ambient audio could not start automatically. User interaction is needed for browser audio autoplay rules.');
    });
  });

  markerEl.addEventListener('markerLost', () => {
    markerIsVisible = false;
    touchStartX = null;
    touchStartY = null;
    spellbook.removeAttribute('animation');
    spellbook.removeAttribute('animation__reveal');
    spellbook.setAttribute('rotation', '0 90 0');
    spellbook.setAttribute('scale', '0.15 0.15 0.15');
    if (spellbookEffects) spellbookEffects.setAttribute('visible', 'false');
    if (recipePage) recipePage.setAttribute('visible', 'false');
    if (runeRing) runeRing.removeAttribute('animation');
    magicMotes.forEach((mote) => {
      mote.removeAttribute('animation__float');
      mote.removeAttribute('animation__pulse');
    });
    if (markerStatus) markerStatus.textContent = 'Marker lost — scan again';
  });
}
