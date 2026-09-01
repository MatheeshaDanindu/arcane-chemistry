const markerStatus = document.getElementById('marker-status');
const sceneEl = document.querySelector('a-scene');
const markerEl = document.getElementById('hiro-marker');
const spellbook = document.getElementById('spellbook');

const ambientAudio = new Audio('assets/audio/ambient-hum.mp3');
ambientAudio.loop = true;
ambientAudio.volume = 0.18;

if (sceneEl && markerEl && spellbook) {
  markerEl.addEventListener('markerFound', () => {
    spellbook.setAttribute('animation', 'property: rotation; to: 0 360 0; loop: true; dur: 7000; easing: linear');
    spellbook.setAttribute('animation__pulse', 'property: scale; to: 0.4 0.4 0.4; loop: true; dir: alternate; dur: 1200');
    if (markerStatus) markerStatus.textContent = 'Marker detected — spellbook activated';

    ambientAudio.play().catch(() => {
      console.warn('Ambient audio could not start automatically. User interaction is needed for browser audio autoplay rules.');
    });
  });

  markerEl.addEventListener('markerLost', () => {
    spellbook.removeAttribute('animation');
    spellbook.removeAttribute('animation__pulse');
    spellbook.setAttribute('rotation', '0 90 0');
    spellbook.setAttribute('scale', '0.32 0.32 0.32');
    if (markerStatus) markerStatus.textContent = 'Marker lost — scan again';
  });
}
