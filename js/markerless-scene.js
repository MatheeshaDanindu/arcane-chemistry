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
const cameraPreviewButton = document.getElementById('camera-preview-button');
const ingredientHelp = document.getElementById('ingredient-help');
const brewStateElement = document.getElementById('brew-state');
const reactionResultElement = document.getElementById('reaction-result');
const reactionHistoryElement = document.getElementById('reaction-history');
const dataSourceElement = document.getElementById('data-source');
const resetBrewButton = document.getElementById('reset-brew-button');
const brewProgress = document.getElementById('brew-progress');
const brewProgressFill = document.getElementById('brew-progress-fill');
const brewProgressValue = document.getElementById('brew-progress-value');
const brewProgressTrack = brewProgress?.querySelector('.brew-progress-track');

function setStatus(message) {
  if (statusElement) statusElement.textContent = message;
}

function setBrewingState(state, message) {
  brewingState = state;
  if (brewStateElement) brewStateElement.textContent = `State: ${message}`;
}

function setIngredientAvailability(enabled) {
  document.querySelectorAll('.ingredient-btn').forEach((button) => {
    button.disabled = !enabled;
  });
  if (resetBrewButton) resetBrewButton.disabled = !enabled;
}

function clearIngredientSelection() {
  selectedIngredients = [];
  document.querySelectorAll('.ingredient-btn').forEach((button) => button.classList.remove('selected'));
}

function renderHistory() {
  if (!reactionHistoryElement) return;
  reactionHistoryElement.innerHTML = brewHistory.length
    ? brewHistory.map((entry) => `<div class="history-entry">${entry.ingredients} → ${entry.label}</div>`).join('')
    : 'Your completed brews will appear here.';
}

function updateBrewProgress(value) {
  const progress = Math.max(0, Math.min(100, Math.round(value)));
  if (brewProgressFill) brewProgressFill.style.width = `${progress}%`;
  if (brewProgressValue) brewProgressValue.textContent = `${progress}%`;
  if (brewProgressTrack) brewProgressTrack.setAttribute('aria-valuenow', String(progress));
}

function setBrewProgressVisible(visible) {
  if (brewProgress) brewProgress.hidden = !visible;
}

function animateBrewing(duration) {
  setBrewProgressVisible(true);
  updateBrewProgress(0);

  return new Promise((resolve) => {
    const startedAt = performance.now();
    const tick = (now) => {
      const progress = Math.min(100, ((now - startedAt) / duration) * 100);
      updateBrewProgress(progress);
      if (progress < 100) {
        window.requestAnimationFrame(tick);
      } else {
        resolve();
      }
    };
    window.requestAnimationFrame(tick);
  });
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

if (cameraPreviewButton) {
  cameraPreviewButton.addEventListener('click', startCameraFallback);
}

if (!navigator.xr) {
  startCameraFallback();
} else if (navigator.xr.isSessionSupported) {
  navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
    if (supported) {
      setStatus('Tap START AR below to open the camera and scan a surface.');
      if (cameraPreviewButton) cameraPreviewButton.style.display = 'block';
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
let brewingState = 'awaitingPlacement';
let selectedIngredients = [];
let brewHistory = [];
let placementLocked = false;
let ingredientJarsGroup = null;
let ingredientJarTemplate = null;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const xrController = renderer.xr.getController(0);

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

function createGlowParticleMaterial(color, size, opacity) {
  return new THREE.ShaderMaterial({
    uniforms: {
      particleColor: { value: new THREE.Color(color) },
      particleSize: { value: size },
      particleOpacity: { value: opacity },
      time: { value: 0 }
    },
    vertexShader: `
      uniform float particleSize;
      uniform float time;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        float drift = sin(time * 1.4 + position.y * 8.0) * 0.012;
        worldPosition.x += drift;
        worldPosition.z += cos(time * 1.1 + position.x * 7.0) * 0.01;
        vec4 viewPosition = viewMatrix * worldPosition;
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = particleSize * (190.0 / max(1.0, -viewPosition.z));
      }
    `,
    fragmentShader: `
      uniform vec3 particleColor;
      uniform float particleOpacity;
      void main() {
        vec2 point = gl_PointCoord - vec2(0.5);
        float distanceFromCenter = length(point);
        float softEdge = 1.0 - smoothstep(0.08, 0.5, distanceFromCenter);
        float halo = 1.0 - smoothstep(0.18, 0.5, distanceFromCenter);
        if (distanceFromCenter > 0.5) discard;
        gl_FragColor = vec4(particleColor * (1.0 + halo * 0.8), softEdge * particleOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
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
  const steamMaterial = createGlowParticleMaterial(0xf4d35e, 0.028, 0.82);
  const steam = new THREE.Points(steamGeometry, steamMaterial);
  steam.position.y = 0.3;
  steam.visible = false;
  group.add(steam);

  group.userData.steam = steam;
  group.userData.liquid = liquid;
  group.userData.steamMaterial = steamMaterial;
  return group;
}

function buildCauldronFromModel(model) {
  const root = model.scene || model;
  root.scale.set(0.65, 0.65, 0.65);
  root.position.y = 0.02;

  root.updateMatrixWorld(true);
  const modelBounds = new THREE.Box3().setFromObject(root);
  let bodyBounds = null;
  let largestBodyVolume = 0;

  root.traverse((child) => {
    if (!child.isMesh) return;
    const childBounds = new THREE.Box3().setFromObject(child);
    const childSize = childBounds.getSize(new THREE.Vector3());
    const childVolume = childSize.x * childSize.y * childSize.z;
    if (childVolume > largestBodyVolume) {
      largestBodyVolume = childVolume;
      bodyBounds = childBounds;
    }
  });

  const openingBounds = bodyBounds || modelBounds;
  const modelCenter = openingBounds.getCenter(new THREE.Vector3());
  const liquidWorldPosition = new THREE.Vector3(
    modelCenter.x,
    openingBounds.max.y - (openingBounds.max.y - openingBounds.min.y) * 0.16,
    modelCenter.z
  );
  root.worldToLocal(liquidWorldPosition);

  const liquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.22, 0.06, 32),
    new THREE.MeshStandardMaterial({ color: 0x6ee7b7, emissive: 0x113322, transparent: true, opacity: 0.9 })
  );
  liquid.position.copy(liquidWorldPosition);
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
  const steamMaterial = createGlowParticleMaterial(0xf4d35e, 0.032, 0.86);
  const steam = new THREE.Points(steamGeometry, steamMaterial);
  steam.position.y = 0.34;
  steam.visible = false;
  root.add(steam);

  root.userData.steam = steam;
  root.userData.liquid = liquid;
  root.userData.steamMaterial = steamMaterial;
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

function createJarLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  context.fillStyle = 'rgba(10, 16, 28, 0.88)';
  context.roundRect(3, 3, 250, 58, 12);
  context.fill();
  context.font = 'bold 22px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#f4d35e';
  context.fillText(text, 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  label.scale.set(0.32, 0.08, 1);
  label.position.y = 0.28;
  return label;
}

function createIngredientJar(ingredient, index, angle) {
  const jar = ingredientJarTemplate.clone(true);
  jar.scale.setScalar(0.16);
  jar.position.set(Math.cos(angle) * 0.62, 0.02, Math.sin(angle) * 0.62);
  jar.rotation.y = -angle;
  jar.userData.ingredient = ingredient;
  jar.userData.baseY = jar.position.y;
  jar.userData.phase = index * 0.8;
  jar.userData.selectable = true;
  jar.add(createJarLabel(window.ArcaneChemistry?.ingredientDetails?.[ingredient]?.label || ingredient));

  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(0.12, 24),
    new THREE.MeshBasicMaterial({ color: 0x77d5f8, transparent: true, opacity: 0.16, side: THREE.DoubleSide })
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = -0.01;
  halo.userData.jarHalo = true;
  jar.add(halo);
  return jar;
}

async function addIngredientJars() {
  if (!cauldronRoot || ingredientJarsGroup) return;

  try {
    const gltf = await new Promise((resolve, reject) => {
      loader.load('assets/models/ingredient-jar.glb', resolve, undefined, reject);
    });
    ingredientJarTemplate = gltf.scene;
  } catch (error) {
    console.warn('Ingredient jar model could not load:', error);
    return;
  }

  ingredientJarsGroup = new THREE.Group();
  ingredientJarsGroup.name = 'apothecary-jars';
  cauldronRoot.add(ingredientJarsGroup);

  const ingredients = ['vinegar', 'baking_soda', 'copper_sulfate', 'iron', 'hydrochloric_acid', 'sodium_hydroxide'];
  ingredients.forEach((ingredient, index) => {
    const jar = createIngredientJar(ingredient, index, (index / ingredients.length) * Math.PI * 2);
    ingredientJarsGroup.add(jar);
  });
}

function selectIngredientFromJar(ingredient) {
  const button = document.querySelector(`.ingredient-btn[data-ingredient="${ingredient}"]`);
  if (button && !button.disabled) button.click();
}

function handleJarPointer(event) {
  if (!ingredientJarsGroup || brewingState === 'brewing' || brewingState === 'resultDisplayed') return;
  const bounds = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const intersections = raycaster.intersectObjects(ingredientJarsGroup.children, true);
  const jar = intersections.find((hit) => {
    let current = hit.object;
    while (current && current !== ingredientJarsGroup) {
      if (current.userData.selectable) return true;
      current = current.parent;
    }
    return false;
  });
  if (!jar) return;

  let selectedJar = jar.object;
  while (selectedJar.parent && !selectedJar.userData.selectable) selectedJar = selectedJar.parent;
  selectIngredientFromJar(selectedJar.userData.ingredient);
}

function updateCauldronReaction(reaction) {
  if (!cauldronRoot || !cauldronRoot.userData.liquid) return;

  const liquid = cauldronRoot.userData.liquid;
  const steam = cauldronRoot.userData.steam;
  if (!liquid.material || !steam) return;

  liquid.material.color.setHex(reaction.color);
  liquid.material.emissive = new THREE.Color(reaction.color).multiplyScalar(0.2);
  liquid.material.needsUpdate = true;

  cauldronRoot.scale.multiplyScalar(1.08);
  window.setTimeout(() => {
    if (cauldronRoot) cauldronRoot.scale.multiplyScalar(0.9259);
  }, 450);

  if (reaction.effect === 'fizz') {
    steam.visible = true;
    steam.scale.setScalar(1.5);
    playReactionAudio('fizz');
  } else if (reaction.effect === 'neutralize') {
    steam.visible = false;
    playReactionAudio('neutralize');
  } else if (reaction.effect === 'displacement' || reaction.effect === 'precipitate') {
    steam.visible = true;
    steam.scale.setScalar(1.25);
    playReactionAudio('displacement');
  } else {
    steam.visible = false;
  }

  setStatus(`${reaction.label} — ${reaction.description}`);
}

async function handleMix() {
  if (selectedIngredients.length < 2 || !cauldronRoot || brewingState !== 'ingredientBSelected') {
    return;
  }

  const [first, second] = selectedIngredients;
  const fallbackReaction = window.ArcaneChemistry?.getReaction(first, second) || { color: 0x888888, effect: 'none', label: 'No reaction', description: 'These ingredients do not react in a useful way.', tempChange: 0 };
  setBrewingState('brewing', 'brewing your potion');
  setStatus('The cauldron is stirring... consult the stars while the brew settles.');
  if (ingredientHelp) ingredientHelp.textContent = 'Your reagents are reacting...';
  cauldronRoot.userData.steam.visible = true;
  await animateBrewing(1800);
  const details = await window.ArcaneChemistry?.getReactionDetails(first, second);
  const reaction = details?.reaction || fallbackReaction;

  updateCauldronReaction(reaction);
  setBrewingState('resultDisplayed', 'brew complete');
  setBrewProgressVisible(false);
  if (dataSourceElement) dataSourceElement.textContent = details?.fallback ? 'Curated fallback dataset' : 'PubChem data retrieved';
  if (reactionResultElement) {
    reactionResultElement.innerHTML = `<strong>${reaction.label}</strong><br>${reaction.description}<br><br>Temperature change: ${reaction.tempChange > 0 ? '+' : ''}${reaction.tempChange}°C<br>Effect: ${reaction.effect}<br>${details ? `${details.first.formula || 'Unknown'} + ${details.second.formula || 'Unknown'}` : 'Formula data unavailable'}`;
  }
  brewHistory.unshift({ ingredients: `${first} + ${second}`, label: reaction.label });
  brewHistory = brewHistory.slice(0, 4);
  renderHistory();

  document.querySelectorAll('.ingredient-btn').forEach((button) => { button.disabled = true; });
}

function attachIngredientInteractions() {
  const buttons = Array.from(document.querySelectorAll('.ingredient-btn'));
  buttons.forEach((button) => {
    button.addEventListener('pointerdown', (event) => event.stopPropagation());
    button.addEventListener('click', () => {
      const ingredient = button.dataset.ingredient;
      if (!ingredient) return;

      if (!cauldronRoot || brewingState === 'awaitingPlacement' || brewingState === 'brewing') {
        setStatus('Place the cauldron before adding ingredients to the potion.');
        return;
      }

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
        setBrewingState('ingredientBSelected', 'two reagents selected');
        handleMix();
      } else {
        setBrewingState('ingredientASelected', 'choose a second reagent');
        setStatus(`${ingredient} added to the cauldron. Choose one more reagent.`);
      }
    });
  });
}

renderer.xr.addEventListener('sessionstart', async () => {
  const session = renderer.xr.getSession();
  placementLocked = false;
  if (cauldronRoot) {
    scene.remove(cauldronRoot);
    cauldronRoot = null;
  }
  setIngredientAvailability(false);
  clearIngredientSelection();
  setBrewingState('awaitingPlacement', 'awaiting placement');
  const viewerSpace = await session.requestReferenceSpace('viewer');
  hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
  hitTestSourceRequested = true;
  setStatus('Move your phone to scan a surface, then tap the reticle to place the cauldron.');
  if (cameraPreviewButton) cameraPreviewButton.style.display = 'none';
});

renderer.xr.addEventListener('sessionend', () => {
  hitTestSource = null;
  hitTestSourceRequested = false;
  reticle.visible = false;
  setStatus('AR session ended. Tap START AR to try again.');
  if (cameraPreviewButton) cameraPreviewButton.style.display = 'block';
});

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.name === 'NotSupportedError' || event.reason?.name === 'InvalidStateError') {
    setStatus('AR session could not start on this device. Tap Open Camera Preview, or use an ARCore Android phone.');
    if (cameraPreviewButton) cameraPreviewButton.style.display = 'block';
  }
});

function renderReticle(frame) {
  if (!hitTestSource || !reticle || placementLocked) return;

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
    cauldronRoot.rotation.y += brewingState === 'brewing' ? 0.025 : 0.003;
    if (brewingState === 'brewing') {
      cauldronRoot.position.y = cauldronRoot.userData.restY + Math.sin(time * 0.012) * 0.0008;
    }
    const steam = cauldronRoot.userData.steam;
    if (steam) {
      steam.rotation.y += 0.01;
    }
    const steamMaterial = cauldronRoot.userData.steamMaterial;
    if (steamMaterial) {
      steamMaterial.uniforms.time.value = time * 0.001;
    }
  }

  if (ingredientJarsGroup) {
    ingredientJarsGroup.children.forEach((jar) => {
      jar.position.y = jar.userData.baseY + Math.sin(time * 0.002 + jar.userData.phase) * 0.012;
      jar.rotation.y += 0.002;
      jar.traverse((child) => {
        if (child.userData.jarHalo && child.material) {
          child.material.opacity = selectedIngredients.includes(jar.userData.ingredient) ? 0.62 : 0.16;
        }
      });
    });
  }
});

async function placeCauldronAtReticle() {
  if (!reticle.visible || placementLocked) {
    return;
  }

  placementLocked = true;
  reticle.visible = false;

  if (!cauldronRoot) {
    cauldronRoot = await loadCauldronModel();
    scene.add(cauldronRoot);
  }

  cauldronRoot.position.setFromMatrixPosition(reticle.matrix);
  cauldronRoot.visible = true;
  cauldronRoot.position.y += 0.02;
  cauldronRoot.userData.restY = cauldronRoot.position.y;
  setIngredientAvailability(true);
  setBrewingState('ready', 'cauldron placed');
  if (ingredientHelp) ingredientHelp.textContent = 'Choose your first reagent from the apothecary shelf.';
  setStatus('The cauldron is ready. Choose two reagents to begin brewing.');
  addIngredientJars();
}

function resetBrew() {
  if (!cauldronRoot) return;
  clearIngredientSelection();
  cauldronRoot.userData.liquid.material.color.setHex(0x6ee7b7);
  cauldronRoot.userData.liquid.material.emissive.setHex(0x113322);
  cauldronRoot.userData.steam.visible = false;
  setIngredientAvailability(true);
  setBrewingState('ready', 'cauldron cleared');
  if (ingredientHelp) ingredientHelp.textContent = 'Choose your first reagent from the apothecary shelf.';
  if (reactionResultElement) reactionResultElement.textContent = 'The cauldron is clear. Begin a new brew.';
  if (dataSourceElement) dataSourceElement.textContent = 'Curated fallback ready';
  setBrewProgressVisible(false);
  updateBrewProgress(0);
  setStatus('The cauldron has been cleared. Choose two new reagents.');
}

window.addEventListener('click', (event) => {
  const target = event.target;
  if (target && target.closest && (target.closest('.ingredient-btn') || target.closest('.hud') || target.closest('.ingredient-ui') || target.closest('.potion-log') || target.closest('#camera-preview-button'))) {
    return;
  }

  if (reticle.visible && !placementLocked) {
    placeCauldronAtReticle();
  }
});

if (resetBrewButton) {
  resetBrewButton.addEventListener('click', resetBrew);
}

renderer.domElement.addEventListener('pointerup', handleJarPointer);
xrController.addEventListener('select', () => {
  if (!ingredientJarsGroup || brewingState === 'brewing' || brewingState === 'resultDisplayed') return;
  raycaster.setFromXRController(xrController);
  const intersections = raycaster.intersectObjects(ingredientJarsGroup.children, true);
  if (intersections.length === 0) return;
  let selectedJar = intersections[0].object;
  while (selectedJar.parent && !selectedJar.userData.selectable) selectedJar = selectedJar.parent;
  selectIngredientFromJar(selectedJar.userData.ingredient);
});
scene.add(xrController);

setIngredientAvailability(false);
renderHistory();
attachIngredientInteractions();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
