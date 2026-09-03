import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 20);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;

document.body.appendChild(renderer.domElement);

document.body.appendChild(
  ARButton.createButton(renderer, {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay'],
    domOverlay: { root: document.body }
  })
);

const statusElement = document.getElementById('reaction-status');
const fallbackVideo = document.getElementById('camera-fallback');

function setStatus(message) {
  if (statusElement) statusElement.textContent = message;
}

async function startCameraFallback() {
  if (!fallbackVideo || !navigator.mediaDevices?.getUserMedia) {
    setStatus('Camera API unavailable. Use Android Chrome over HTTPS for markerless AR.');
    return;
  }

  if (!window.isSecureContext) {
    setStatus('Camera requires HTTPS. Open the GitHub Pages HTTPS address, not a local HTTP address.');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    fallbackVideo.srcObject = stream;
    fallbackVideo.style.display = 'block';
    setStatus('Camera preview active. WebXR placement requires Android Chrome with START AR support.');
  } catch (error) {
    console.warn('Camera fallback could not start:', error);
    setStatus(`Camera access failed (${error.name}). Check site permissions and HTTPS.`);
  }
}

if (!navigator.xr) {
  startCameraFallback();
} else if (navigator.xr.isSessionSupported) {
  navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
    if (supported) {
      setStatus('Tap START AR below to open the camera and scan a surface.');
    } else {
      startCameraFallback();
    }
  }).catch(() => startCameraFallback());
} else {
  startCameraFallback();
}

const ambient = new THREE.HemisphereLight(0xf0f8ff, 0x3a2e2e, 1.25);
scene.add(ambient);

const directional = new THREE.DirectionalLight(0xffffff, 1.1);
directional.position.set(2, 4, 2);
scene.add(directional);

const reticleGeometry = new THREE.RingGeometry(0.08, 0.12, 32).rotateX(-Math.PI / 2);
const reticleMaterial = new THREE.MeshBasicMaterial({ color: 0x77d5f8, side: THREE.DoubleSide });
const reticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
reticle.visible = false;
reticle.position.y = 0.01;
scene.add(reticle);

let hitTestSource = null;
let hitTestSourceRequested = false;
let cauldronModel = null;
let cauldronRoot = null;
let brewingState = 'idle';
let selectedIngredients = [];

const loader = new GLTFLoader();
const reactionAudio = {
  fizz: new Audio('assets/audio/reaction-fizz.mp3'),
  neutralize: new Audio('assets/audio/reaction-neutralize.mp3'),
  displacement: new Audio('assets/audio/reaction-displacement.mp3')
};

function playReactionAudio(effect) {
  const sound = reactionAudio[effect];
  if (!sound) return;
  sound.currentTime = 0;
  sound.volume = 0.45;
  sound.play().catch(() => {
    console.warn('Reaction audio could not start automatically.');
  });
}

function loadPlaceholderCauldron() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.3, 0.18, 32),
    new THREE.MeshStandardMaterial({ color: 0x4a4f63, metalness: 0.6, roughness: 0.4 })
  );
  body.position.y = 0.09;
  group.add(body);

  const liquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.22, 0.08, 32),
    new THREE.MeshStandardMaterial({ color: 0x6ee7b7, emissive: 0x113322, transparent: true, opacity: 0.9 })
  );
  liquid.position.y = 0.14;
  group.add(liquid);

  const steamGeometry = new THREE.BufferGeometry();
  const steamCount = 30;
  const positions = new Float32Array(steamCount * 3);
  for (let i = 0; i < steamCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 0.3;
    positions[i * 3 + 1] = Math.random() * 0.4;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
  }
  steamGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const steamMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.02, transparent: true, opacity: 0.7 });
  const steam = new THREE.Points(steamGeometry, steamMaterial);
  steam.position.y = 0.3;
  steam.visible = false;
  group.add(steam);

  group.userData.steam = steam;
  group.userData.liquid = liquid;
  return group;
}

function buildCauldronFromModel(model) {
  const root = model.scene || model;
  root.scale.set(0.65, 0.65, 0.65);
  root.position.y = 0.02;

  const liquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.22, 0.08, 32),
    new THREE.MeshStandardMaterial({ color: 0x6ee7b7, emissive: 0x113322, transparent: true, opacity: 0.9 })
  );
  liquid.position.y = 0.16;
  liquid.visible = true;
  root.add(liquid);

  const steamGeometry = new THREE.BufferGeometry();
  const steamCount = 26;
  const positions = new Float32Array(steamCount * 3);
  for (let i = 0; i < steamCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 0.35;
    positions[i * 3 + 1] = Math.random() * 0.5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.35;
  }
  steamGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const steamMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.025, transparent: true, opacity: 0.75 });
  const steam = new THREE.Points(steamGeometry, steamMaterial);
  steam.position.y = 0.34;
  steam.visible = false;
  root.add(steam);

  root.userData.steam = steam;
  root.userData.liquid = liquid;
  return root;
}

function loadCauldronModel() {
  return new Promise((resolve) => {
    loader.load(
      'assets/models/cauldron.glb',
      (gltf) => resolve(buildCauldronFromModel(gltf)),
      undefined,
      () => resolve(loadPlaceholderCauldron())
    );
  });
}

function updateCauldronReaction(reaction) {
  if (!cauldronRoot || !cauldronRoot.userData.liquid) return;

  const liquid = cauldronRoot.userData.liquid;
  const steam = cauldronRoot.userData.steam;
  if (!liquid.material || !steam) return;

  liquid.material.color.setHex(reaction.color);
  liquid.material.emissive = new THREE.Color(reaction.color).multiplyScalar(0.2);

  if (reaction.effect === 'fizz') {
    steam.visible = true;
    playReactionAudio('fizz');
  } else if (reaction.effect === 'neutralize') {
    steam.visible = false;
    playReactionAudio('neutralize');
  } else if (reaction.effect === 'displacement' || reaction.effect === 'precipitate') {
    steam.visible = true;
    playReactionAudio('displacement');
  } else {
    steam.visible = false;
  }

  const statusElement = document.getElementById('reaction-status');
  if (statusElement) {
    statusElement.textContent = `${reaction.label} — ${reaction.description}`;
  }
}

async function handleMix() {
  if (selectedIngredients.length < 2 || !cauldronRoot) {
    return;
  }

  const [first, second] = selectedIngredients;
  const reaction = window.ArcaneChemistry?.getReaction(first, second) || { color: 0x888888, effect: 'none', label: 'No reaction', description: 'These ingredients do not react in a useful way.' };
  const details = await window.ArcaneChemistry?.getReactionDetails(first, second);

  if (details && details.reaction) {
    updateCauldronReaction(details.reaction);
  } else {
    updateCauldronReaction(reaction);
  }

  brewingState = 'resultDisplayed';
}

function attachIngredientInteractions() {
  const buttons = Array.from(document.querySelectorAll('.ingredient-btn'));
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const ingredient = button.dataset.ingredient;
      if (!ingredient) return;

      if (selectedIngredients.includes(ingredient)) {
        selectedIngredients = selectedIngredients.filter((item) => item !== ingredient);
        button.classList.remove('selected');
        return;
      }

      if (selectedIngredients.length >= 2) {
        const firstButton = buttons.find((item) => item.dataset.ingredient === selectedIngredients[0]);
        if (firstButton) firstButton.classList.remove('selected');
        selectedIngredients = [];
      }

      selectedIngredients.push(ingredient);
      button.classList.add('selected');

      if (selectedIngredients.length === 2) {
        handleMix();
      }
    });
  });
}

renderer.xr.addEventListener('sessionstart', async () => {
  const session = renderer.xr.getSession();
  const viewerSpace = await session.requestReferenceSpace('viewer');
  hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
  hitTestSourceRequested = true;
  setStatus('Move your phone to scan a surface, then tap the reticle to place the cauldron.');
});

renderer.xr.addEventListener('sessionend', () => {
  hitTestSource = null;
  hitTestSourceRequested = false;
  reticle.visible = false;
  setStatus('AR session ended. Tap START AR to try again.');
});

function renderReticle(frame) {
  if (!hitTestSource || !reticle) return;

  const session = renderer.xr.getSession();
  if (!session) return;

  const referenceSpace = renderer.xr.getReferenceSpace();
  if (!referenceSpace) return;

  const hitTestResults = frame.getHitTestResults(hitTestSource);
  if (hitTestResults.length > 0) {
    const hit = hitTestResults[0];
    const pose = hit.getPose(referenceSpace);
    if (pose) {
      reticle.visible = true;
      reticle.matrix.fromArray(pose.transform.matrix);
      reticle.matrix.decompose(reticle.position, reticle.quaternion, reticle.scale);
      reticle.position.y += 0.01;
      return;
    }
  }

  reticle.visible = false;
}

renderer.setAnimationLoop((time) => {
  renderer.render(scene, camera);

  const frame = renderer.xr.getFrame();
  if (frame && hitTestSource && hitTestSourceRequested) {
    renderReticle(frame);
  }

  if (cauldronRoot) {
    cauldronRoot.rotation.y += 0.003;
    const steam = cauldronRoot.userData.steam;
    if (steam) {
      steam.rotation.y += 0.01;
    }
  }
});

async function placeCauldronAtReticle() {
  if (!reticle.visible) {
    return;
  }

  if (!cauldronRoot) {
    cauldronRoot = await loadCauldronModel();
    scene.add(cauldronRoot);
  }

  cauldronRoot.position.setFromMatrixPosition(reticle.matrix);
  cauldronRoot.visible = true;
  cauldronRoot.position.y += 0.02;
}

window.addEventListener('click', (event) => {
  const target = event.target;
  if (target && target.classList && target.classList.contains('ingredient-btn')) {
    return;
  }

  if (reticle.visible) {
    placeCauldronAtReticle();
  }
});

attachIngredientInteractions();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
