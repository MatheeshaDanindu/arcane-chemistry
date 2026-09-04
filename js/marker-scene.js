const markerStatus = document.getElementById('marker-status');
const sceneEl = document.querySelector('a-scene');
const markerEl = document.getElementById('custom-marker');
const spellbook = document.getElementById('spellbook');
const spellbookEffects = document.getElementById('spellbook-effects');
const runeRing = document.getElementById('rune-ring');
const magicMotes = Array.from(document.querySelectorAll('.magic-mote'));

const ambientAudio = new Audio('assets/audio/ambient-hum.mp3');
ambientAudio.loop = true;
ambientAudio.volume = 0.18;

if (sceneEl && markerEl && spellbook) {
  markerEl.addEventListener('markerFound', () => {
    spellbook.removeAttribute('animation');
    spellbook.removeAttribute('animation__reveal');
    spellbook.setAttribute('scale', '0.001 0.001 0.001');
    spellbook.setAttribute('animation__reveal', 'property: scale; from: 0.001 0.001 0.001; to: 0.15 0.15 0.15; dur: 900; easing: easeOutElastic');
    if (spellbookEffects) spellbookEffects.setAttribute('visible', 'true');
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
    spellbook.removeAttribute('animation');
    spellbook.removeAttribute('animation__reveal');
    spellbook.setAttribute('rotation', '0 90 0');
    spellbook.setAttribute('scale', '0.15 0.15 0.15');
    if (spellbookEffects) spellbookEffects.setAttribute('visible', 'false');
    if (runeRing) runeRing.removeAttribute('animation');
    magicMotes.forEach((mote) => {
      mote.removeAttribute('animation__float');
      mote.removeAttribute('animation__pulse');
    });
    if (markerStatus) markerStatus.textContent = 'Marker lost — scan again';
  });
}
