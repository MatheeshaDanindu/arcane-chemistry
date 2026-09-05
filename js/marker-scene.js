const markerStatus = document.getElementById('marker-status');
const sceneEl = document.querySelector('a-scene');
const markerEl = document.getElementById('custom-marker');
const spellbook = document.getElementById('spellbook');
const spellbookEffects = document.getElementById('spellbook-effects');
const runeRing = document.getElementById('rune-ring');
const magicMotes = Array.from(document.querySelectorAll('.magic-mote'));
const recipeHinge = document.getElementById('recipe-hinge');
const recipeLeaf = document.getElementById('recipe-leaf');
const recipeTitle = document.getElementById('recipe-title');
const recipeContent = document.getElementById('recipe-content');
const recipeLeafSurface = document.querySelector('.tappable-recipe-page');

const recipes = [
  {
    title: 'Fizzing Solution',
    content: 'Vinegar + Baking Soda\nCH3COOH + NaHCO3\nCO2 gas + water + sodium acetate'
  },
  {
    title: 'Copper Displacement',
    content: 'Copper Sulfate + Iron\nCuSO4 + Fe\nIron displaces copper from solution'
  },
  {
    title: 'Neutralising Draught',
    content: 'Hydrochloric Acid + Sodium Hydroxide\nHCl + NaOH\nSalt + water in a neutralisation reaction'
  }
];

let recipeIndex = -1; // -1 means the recipe page hasn't been opened yet
let markerIsVisible = false;
let touchStartX = null;
let touchStartY = null;
let isFlipping = false;
let ignoreClickUntil = 0;

const ambientAudio = new Audio('assets/audio/ambient-hum.mp3');
ambientAudio.loop = true;
ambientAudio.volume = 0.18;

const pageFlipAudio = new Audio('assets/audio/page-flip.mp3');
pageFlipAudio.volume = 0.6;

function playPageFlipSound() {
  // Rewind before playing so rapid swipes each retrigger the sound from the start.
  pageFlipAudio.currentTime = 0;
  pageFlipAudio.play().catch(() => {
    console.warn('Page-flip sound could not play automatically.');
  });
}

function applyRecipeContent(index) {
  const recipe = recipes[index];
  if (recipeTitle) recipeTitle.setAttribute('value', recipe.title);
  if (recipeContent) recipeContent.setAttribute('value', recipe.content);
}

// Flips the recipe leaf around the book's spine, like a real page turning.
// direction: 1 turns to the next recipe (page lifts and turns away to the left),
//           -1 turns back to the previous recipe (page lifts and turns away to the right).
function turnPage(direction) {
  if (!recipeHinge || !recipeLeaf || isFlipping) return;

  const opening = recipeIndex === -1;
  const nextIndex = (recipeIndex + direction + recipes.length) % recipes.length;
  const peakDeg = direction > 0 ? 82 : -82;

  recipeHinge.removeAttribute('animation__up');
  recipeHinge.removeAttribute('animation__down');
  isFlipping = true;
  recipeLeaf.setAttribute('visible', 'true');
  playPageFlipSound();

  if (opening) {
    // First reveal: the page drops in from edge-on, landing flat and open on the book.
    applyRecipeContent(nextIndex);
    recipeHinge.setAttribute('animation__down', `property: rotation; from: 0 0 ${peakDeg}; to: 0 0 0; dur: 320; easing: easeOutBack`);
    recipeHinge.addEventListener('animationcomplete__down', function onDone() {
      recipeHinge.removeEventListener('animationcomplete__down', onDone);
      isFlipping = false;
    });
  } else {
    // Lift the current page on its hinge until it's edge-on (effectively invisible),
    // swap in the new recipe, then drop it back down flat.
    recipeHinge.setAttribute('animation__up', `property: rotation; from: 0 0 0; to: 0 0 ${peakDeg}; dur: 220; easing: easeInQuad`);
    recipeHinge.addEventListener('animationcomplete__up', function onUp() {
      recipeHinge.removeEventListener('animationcomplete__up', onUp);
      applyRecipeContent(nextIndex);
      recipeHinge.setAttribute('animation__down', `property: rotation; from: 0 0 ${peakDeg}; to: 0 0 0; dur: 260; easing: easeOutQuad`);
      recipeHinge.addEventListener('animationcomplete__down', function onDown() {
        recipeHinge.removeEventListener('animationcomplete__down', onDown);
        isFlipping = false;
      });
    });
  }

  recipeIndex = nextIndex;
  if (markerStatus) markerStatus.textContent = `${recipes[nextIndex].title} — swipe to turn the page`;
}

AFRAME.registerComponent('click-to-open', {
  init() {
    this.el.addEventListener('click', () => {
      if (Date.now() < ignoreClickUntil) return;
      turnPage(1);
    });
  }
});

if (recipeLeafSurface) {
  recipeLeafSurface.addEventListener('click', () => {
    if (Date.now() < ignoreClickUntil) return;
    turnPage(1);
  });
}

function handleFingerPageTurn(event) {
  if (!markerIsVisible || recipeIndex === -1) return;
  const touch = event.changedTouches[0];
  if (!touch || touchStartX === null || touchStartY === null) return;

  const horizontalDistance = touch.clientX - touchStartX;
  const verticalDistance = touch.clientY - touchStartY;
  touchStartX = null;
  touchStartY = null;

  if (Math.abs(horizontalDistance) < 45 || Math.abs(horizontalDistance) < Math.abs(verticalDistance)) return;
  ignoreClickUntil = Date.now() + 700;
  turnPage(horizontalDistance < 0 ? 1 : -1);
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
    spellbook.setAttribute('animation__reveal', 'property: scale; from: 0.001 0.001 0.001; to: 2 2 2; dur: 900; easing: easeOutElastic');
    if (spellbookEffects) spellbookEffects.setAttribute('visible', 'true');

    recipeIndex = -1;
    isFlipping = false;
    if (recipeHinge) {
      recipeHinge.removeAttribute('animation__up');
      recipeHinge.removeAttribute('animation__down');
      recipeHinge.setAttribute('rotation', '0 0 0');
    }
    if (recipeLeaf) recipeLeaf.setAttribute('visible', 'false');

    if (runeRing) runeRing.setAttribute('animation', 'property: rotation; to: -90 360 0; loop: true; dur: 9000; easing: linear');
    magicMotes.forEach((mote, index) => {
      mote.setAttribute('animation__float', `property: position; to: ${index % 2 ? '0.46' : '-0.46'} ${0.35 + index * 0.03} ${index % 2 ? '-0.12' : '0.14'}; dir: alternate; loop: true; dur: ${1800 + index * 160}; easing: easeInOutSine`);
      mote.setAttribute('animation__pulse', `property: scale; from: 0.7 0.7 0.7; to: 1.35 1.35 1.35; dir: alternate; loop: true; dur: ${700 + index * 80}`);
    });
    if (markerStatus) markerStatus.textContent = 'Marker detected — tap the spellbook to read a recipe';

    ambientAudio.play().catch(() => {
      console.warn('Ambient audio could not start automatically. User interaction is needed for browser audio autoplay rules.');
    });
  });

  markerEl.addEventListener('markerLost', () => {
    markerIsVisible = false;
    touchStartX = null;
    touchStartY = null;
    isFlipping = false;
    spellbook.removeAttribute('animation');
    spellbook.removeAttribute('animation__reveal');
    spellbook.setAttribute('rotation', '0 0 0');
    spellbook.setAttribute('scale', '2 2 2');
    if (spellbookEffects) spellbookEffects.setAttribute('visible', 'false');

    recipeIndex = -1;
    if (recipeHinge) {
      recipeHinge.removeAttribute('animation__up');
      recipeHinge.removeAttribute('animation__down');
      recipeHinge.setAttribute('rotation', '0 0 0');
    }
    if (recipeLeaf) recipeLeaf.setAttribute('visible', 'false');

    if (runeRing) runeRing.removeAttribute('animation');
    magicMotes.forEach((mote) => {
      mote.removeAttribute('animation__float');
      mote.removeAttribute('animation__pulse');
    });
    if (markerStatus) markerStatus.textContent = 'Marker lost — scan again';
  });
}