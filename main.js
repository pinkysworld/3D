import * as THREE from 'https://unpkg.com/three@0.157.0/build/three.module.js';
import { PointerLockControls } from 'https://unpkg.com/three@0.157.0/examples/jsm/controls/PointerLockControls.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1f2b);
scene.fog = new THREE.FogExp2(0x10131a, 0.018);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 5, 18);

const controls = new PointerLockControls(camera, document.body);

const startScreen = document.getElementById('start-screen');
const startButton = document.getElementById('startButton');
const hud = document.getElementById('hud');
const inventoryPanel = document.getElementById('inventory');
const inventoryList = document.getElementById('inventoryList');
const questTitle = document.getElementById('questTitle');
const questDescription = document.getElementById('questDescription');
const questObjectives = document.getElementById('questObjectives');
const interactionLabel = document.getElementById('interaction');
const messageBox = document.getElementById('message');
const statusPanel = document.getElementById('status');

const moveState = { forward: false, backward: false, left: false, right: false, sprint: false };
let canJump = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let prevTime = performance.now();

const inventory = [];

const quest = {
  id: 'caravan-supplies',
  title: 'Provisions for the Caravan',
  description:
    'The caravan to Lowangen needs supplies for the road. Search the surrounding forest for moonherbs and recover the blacksmith\'s sky-steel ingot before returning to Captain Aranth.',
  objectives: [
    { id: 'moonherb', text: 'Gather 3 Moonherbs from the enchanted forest.', target: 3, progress: 0 },
    { id: 'ingot', text: "Retrieve the sky-steel ingot from the forge's ruins.", target: 1, progress: 0 },
    { id: 'report', text: 'Report back to Captain Aranth in the town square.', target: 1, progress: 0 }
  ],
  completed: false
};

const colliders = [];
const interactables = [];
const itemMeshes = [];

initEnvironment();
initQuestUI();

startButton.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  hud.classList.remove('hidden');
  controls.lock();
});

controls.addEventListener('lock', () => {
  startScreen.classList.add('hidden');
  hud.classList.remove('hidden');
});

controls.addEventListener('unlock', () => {
  startScreen.classList.remove('hidden');
  hud.classList.add('hidden');
  interactionLabel.classList.add('hidden');
});

document.addEventListener('keydown', (event) => {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveState.forward = true;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveState.left = true;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveState.backward = true;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveState.right = true;
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      moveState.sprint = true;
      break;
    case 'Space':
      if (canJump) {
        velocity.y += 250;
        canJump = false;
      }
      break;
    case 'KeyE':
      handleInteraction();
      break;
    case 'KeyI':
      togglePanel(inventoryPanel);
      break;
    case 'KeyQ':
      togglePanel(statusPanel);
      break;
    default:
      break;
  }
});

document.addEventListener('keyup', (event) => {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveState.forward = false;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveState.left = false;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveState.backward = false;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveState.right = false;
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      moveState.sprint = false;
      break;
    default:
      break;
  }
});

window.addEventListener('resize', onWindowResize);

function togglePanel(panel) {
  if (panel.classList.contains('hidden')) {
    panel.classList.remove('hidden');
  } else {
    panel.classList.add('hidden');
  }
}

function initEnvironment() {
  const hemiLight = new THREE.HemisphereLight(0xbcc6ff, 0x2f2a20, 0.6);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xfff5da, 0.8);
  dirLight.position.set(-60, 80, 40);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.far = 200;
  dirLight.shadow.camera.left = -80;
  dirLight.shadow.camera.right = 80;
  dirLight.shadow.camera.top = 80;
  dirLight.shadow.camera.bottom = -80;
  scene.add(dirLight);

  const skyGeo = new THREE.SphereGeometry(220, 32, 32);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color(0x17233f) },
      bottomColor: { value: new THREE.Color(0x2b1f14) },
      offset: { value: 10 },
      exponent: { value: 0.6 }
    },
    vertexShader: `varying vec3 vWorldPosition;\nvoid main() {\nvec4 worldPosition = modelMatrix * vec4(position, 1.0);\nvWorldPosition = worldPosition.xyz;\ngl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}`,
    fragmentShader: `uniform vec3 topColor;\nuniform vec3 bottomColor;\nuniform float offset;\nuniform float exponent;\nvarying vec3 vWorldPosition;\nvoid main() {\n  float h = normalize(vWorldPosition + offset).y;\n  float mixValue = max(pow(max(h, 0.0), exponent), 0.0);\n  gl_FragColor = vec4(mix(bottomColor, topColor, mixValue), 1.0);\n}`
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  createTerrain();
  createTown();
  createForest();
  createWater();
  createProps();
  createNPCs();

  scene.add(controls.getObject());
  controls.getObject().position.set(0, 5, 18);
}

function createTerrain() {
  const size = 250;
  const segments = 128;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const distance = Math.sqrt(x * x + z * z);
    const undulation = Math.sin(distance * 0.045) * 1.5 + Math.cos((x + z) * 0.035) * 1.2;
    let height = Math.max(undulation, 0);
    height += Math.sin(x * 0.1) * Math.cos(z * 0.07) * 0.8;
    if (Math.abs(x) < 50 && Math.abs(z) < 50) {
      height *= 0.2;
    }
    positions.setY(i, height);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0x4c6a3a,
    roughness: 0.9,
    metalness: 0,
    flatShading: true
  });

  const terrain = new THREE.Mesh(geometry, material);
  terrain.receiveShadow = true;
  scene.add(terrain);
}

function createTown() {
  const townCenter = new THREE.Group();

  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(18, 18, 0.2, 32),
    new THREE.MeshStandardMaterial({ color: 0x7a5b3e, roughness: 0.8 })
  );
  plaza.position.set(0, 0.1, 0);
  plaza.receiveShadow = true;
  townCenter.add(plaza);

  const housePositions = [
    new THREE.Vector3(-18, 0, -6),
    new THREE.Vector3(22, 0, 4),
    new THREE.Vector3(-12, 0, 20),
    new THREE.Vector3(16, 0, -18)
  ];

  housePositions.forEach((position, index) => {
    const house = buildHouse(position, index % 2 === 0 ? 1 : -1);
    townCenter.add(house);
    const box = new THREE.Box3().setFromObject(house);
    colliders.push(box);
  });

  const walls = buildTownWalls();
  townCenter.add(walls);
  colliders.push(new THREE.Box3().setFromObject(walls));

  scene.add(townCenter);
}

function buildHouse(position, orientation = 1) {
  const houseGroup = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(10, 6, 8),
    new THREE.MeshStandardMaterial({ color: 0x8f6b4c, roughness: 0.6 })
  );
  body.castShadow = true;
  body.receiveShadow = true;
  body.position.y = 3;
  houseGroup.add(body);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(7, 4, 4),
    new THREE.MeshStandardMaterial({ color: 0x552f1b, roughness: 0.8 })
  );
  roof.castShadow = true;
  roof.position.y = 7;
  roof.rotation.y = Math.PI / 4;
  houseGroup.add(roof);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(2, 3, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x332015 })
  );
  door.position.set(0, 1.5, 4.2);
  houseGroup.add(door);

  const chimney = new THREE.Mesh(
    new THREE.BoxGeometry(1, 3, 1),
    new THREE.MeshStandardMaterial({ color: 0x3a2a24 })
  );
  chimney.position.set(-2, 7.5, -1);
  houseGroup.add(chimney);

  houseGroup.position.copy(position);
  houseGroup.rotation.y = (Math.PI / 2) * orientation;

  return houseGroup;
}

function buildTownWalls() {
  const wallGroup = new THREE.Group();
  const radius = 35;
  const sections = 12;

  for (let i = 0; i < sections; i++) {
    const segment = new THREE.Mesh(
      new THREE.BoxGeometry(10, 6, 2),
      new THREE.MeshStandardMaterial({ color: 0x6b4b31, roughness: 0.9 })
    );
    const angle = (i / sections) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    segment.position.set(x, 3, z);
    segment.lookAt(0, 3, 0);
    segment.castShadow = true;
    segment.receiveShadow = true;
    wallGroup.add(segment);
    colliders.push(new THREE.Box3().setFromObject(segment));
  }

  const gate = new THREE.Mesh(
    new THREE.BoxGeometry(8, 7, 1),
    new THREE.MeshStandardMaterial({ color: 0x5c3d26, roughness: 0.8 })
  );
  gate.position.set(0, 3.5, radius + 1.5);
  wallGroup.add(gate);

  return wallGroup;
}

function createForest() {
  const treeCount = 80;
  for (let i = 0; i < treeCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 60 + Math.random() * 90;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const tree = buildTree();
    tree.position.set(x, 0, z);
    scene.add(tree);
    colliders.push(new THREE.Box3().setFromObject(tree));
  }

  const herbPositions = [
    new THREE.Vector3(48, 0.5, -76),
    new THREE.Vector3(-62, 0.5, -54),
    new THREE.Vector3(-74, 0.5, 40)
  ];

  herbPositions.forEach((pos, idx) => {
    const herb = createCollectible({
      name: `Moonherb ${idx + 1}`,
      questId: 'moonherb',
      description: 'A luminescent herb favored by healers of Aventuria.'
    });
    herb.position.copy(pos);
    scene.add(herb);
    interactables.push({ type: 'item', questId: 'moonherb', mesh: herb, itemName: 'Moonherb', amount: 1 });
    itemMeshes.push(herb);
  });
}

function buildTree() {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.8, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x4b2e1e, roughness: 1 })
  );
  trunk.position.y = 4;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  tree.add(trunk);

  const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x224d1f, roughness: 0.8 });
  const layers = 3;
  for (let i = 0; i < layers; i++) {
    const foliage = new THREE.Mesh(new THREE.ConeGeometry(4 - i, 4, 8), foliageMaterial);
    foliage.position.y = 6 + i * 2.5;
    foliage.castShadow = true;
    foliage.receiveShadow = true;
    tree.add(foliage);
  }

  return tree;
}

function createWater() {
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(16, 32),
    new THREE.MeshStandardMaterial({ color: 0x1e3d5d, transparent: true, opacity: 0.8, metalness: 0.6, roughness: 0.2 })
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(-32, 0.11, 24);
  scene.add(pond);
}

function createProps() {
  const forge = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(6, 2, 6),
    new THREE.MeshStandardMaterial({ color: 0x3b3a39, roughness: 0.9 })
  );
  base.position.y = 1;
  base.receiveShadow = true;
  base.castShadow = true;
  forge.add(base);

  const anvil = new THREE.Mesh(
    new THREE.BoxGeometry(2, 1, 3),
    new THREE.MeshStandardMaterial({ color: 0x1f1f1f, metalness: 0.4, roughness: 0.6 })
  );
  anvil.position.set(0, 2, 0);
  forge.add(anvil);

  forge.position.set(12, 0, -2);
  scene.add(forge);
  colliders.push(new THREE.Box3().setFromObject(forge));

  const ingot = createCollectible({
    name: 'Sky-Steel Ingot',
    questId: 'ingot',
    description: 'A rare ingot forged from star metal, humming with magical energy.'
  });
  ingot.position.set(12, 2.5, -0.5);
  scene.add(ingot);
  interactables.push({ type: 'item', questId: 'ingot', mesh: ingot, itemName: 'Sky-Steel Ingot', amount: 1 });
  itemMeshes.push(ingot);

  const cart = new THREE.Mesh(
    new THREE.BoxGeometry(6, 2, 4),
    new THREE.MeshStandardMaterial({ color: 0x5c482f, roughness: 0.8 })
  );
  cart.position.set(-6, 1, 6);
  cart.castShadow = true;
  cart.receiveShadow = true;
  scene.add(cart);
  colliders.push(new THREE.Box3().setFromObject(cart));
}

function createNPCs() {
  const npc = new THREE.Group();
  const robe = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 4, 12),
    new THREE.MeshStandardMaterial({ color: 0x2b355a, roughness: 0.6 })
  );
  robe.position.y = 2;
  robe.castShadow = true;
  npc.add(robe);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xf1d7b0 })
  );
  head.position.y = 4.6;
  npc.add(head);

  const staff = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 5, 8),
    new THREE.MeshStandardMaterial({ color: 0x8d6d3b })
  );
  staff.position.set(1, 3, 0.6);
  npc.add(staff);

  npc.position.set(2, 0, 0);
  scene.add(npc);

  interactables.push({
    type: 'npc',
    questId: 'report',
    mesh: npc,
    name: 'Captain Aranth',
    onInteract: () => {
      if (isQuestObjectiveComplete('moonherb') && isQuestObjectiveComplete('ingot')) {
        completeObjective('report');
        finishQuest();
      } else {
        showMessage('Captain Aranth: "Gather the moonherbs and recover the sky-steel ingot before you return."');
      }
    }
  });
}

function createCollectible({ name, questId, description }) {
  const geometry = new THREE.DodecahedronGeometry(0.8);
  const material = new THREE.MeshStandardMaterial({
    color: questId === 'moonherb' ? 0x8fd48f : 0xb9d8ff,
    emissive: questId === 'moonherb' ? 0x0a3815 : 0x0c2a4b,
    emissiveIntensity: 0.6,
    roughness: 0.3,
    metalness: 0.1
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { name, questId, description };
  return mesh;
}

function initQuestUI() {
  questTitle.textContent = quest.title;
  questDescription.textContent = quest.description;
  questObjectives.innerHTML = '';
  quest.objectives.forEach((objective) => {
    const li = document.createElement('li');
    li.dataset.objectiveId = objective.id;
    li.textContent = `${objective.text} (0/${objective.target})`;
    questObjectives.appendChild(li);
  });
  updateInventoryUI();
}

function updateQuestUI() {
  quest.objectives.forEach((objective) => {
    const li = questObjectives.querySelector(`li[data-objective-id="${objective.id}"]`);
    if (!li) return;
    li.textContent = `${objective.text} (${objective.progress}/${objective.target})`;
    if (objective.progress >= objective.target) {
      li.classList.add('completed');
    }
  });
}

function updateInventoryUI() {
  inventoryList.innerHTML = '';
  if (!inventory.length) {
    const li = document.createElement('li');
    li.textContent = 'Your pack is empty.';
    inventoryList.appendChild(li);
    return;
  }

  inventory.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = `${item.name}${item.amount > 1 ? ` (x${item.amount})` : ''}`;
    inventoryList.appendChild(li);
  });
}

function isQuestObjectiveComplete(id) {
  const objective = quest.objectives.find((obj) => obj.id === id);
  return objective ? objective.progress >= objective.target : false;
}

function completeObjective(id) {
  const objective = quest.objectives.find((obj) => obj.id === id);
  if (!objective) return;
  objective.progress = Math.min(objective.progress + 1, objective.target);
  updateQuestUI();
}

function finishQuest() {
  if (quest.completed) return;
  if (quest.objectives.every((obj) => obj.progress >= obj.target)) {
    quest.completed = true;
    showMessage('Captain Aranth: "You have our gratitude. The caravan may depart under the stars!"');
  }
}

function addToInventory(itemName, amount = 1) {
  const existing = inventory.find((entry) => entry.name === itemName);
  if (existing) {
    existing.amount += amount;
  } else {
    inventory.push({ name: itemName, amount });
  }
  updateInventoryUI();
}

function removeMesh(mesh) {
  scene.remove(mesh);
  const index = itemMeshes.indexOf(mesh);
  if (index >= 0) {
    itemMeshes.splice(index, 1);
  }
}

function handleInteraction() {
  const target = getClosestInteractable();
  if (!target) return;

  if (target.type === 'item') {
    addToInventory(target.itemName, target.amount);
    completeObjective(target.questId);
    removeMesh(target.mesh);
    showMessage(`You collected ${target.itemName}.`);
    target.collected = true;
  }

  if (target.type === 'npc' && target.onInteract) {
    target.onInteract();
  }
}

function getClosestInteractable() {
  const playerPos = controls.getObject().position;
  let closest = null;
  let minDist = 4;

  interactables.forEach((inter) => {
    if (inter.collected) return;
    const mesh = inter.mesh;
    if (!mesh) return;
    const distance = playerPos.distanceTo(mesh.position);
    if (distance < minDist) {
      minDist = distance;
      closest = inter;
    }
  });

  return closest;
}

function showMessage(text, timeout = 3200) {
  messageBox.textContent = text;
  messageBox.classList.remove('hidden');
  messageBox.classList.add('visible');
  clearTimeout(showMessage.timeoutId);
  showMessage.timeoutId = setTimeout(() => {
    messageBox.classList.remove('visible');
    setTimeout(() => messageBox.classList.add('hidden'), 320);
  }, timeout);
}

function updateInteractionPrompt() {
  const target = getClosestInteractable();
  if (target) {
    interactionLabel.classList.remove('hidden');
    interactionLabel.textContent = target.type === 'npc' ? 'Press E to speak' : 'Press E to collect';
  } else {
    interactionLabel.classList.add('hidden');
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateMovement(delta) {
  if (!controls.isLocked) return;

  const speed = moveState.sprint ? 800 : 400;

  velocity.x -= velocity.x * 10.0 * delta;
  velocity.z -= velocity.z * 10.0 * delta;
  velocity.y -= 9.8 * 70.0 * delta;

  direction.z = Number(moveState.forward) - Number(moveState.backward);
  direction.x = Number(moveState.right) - Number(moveState.left);
  direction.normalize();

  if (moveState.forward || moveState.backward) velocity.z -= direction.z * speed * delta;
  if (moveState.left || moveState.right) velocity.x -= direction.x * speed * delta;

  controls.moveRight(-velocity.x * delta);
  controls.moveForward(-velocity.z * delta);
  controls.getObject().position.y += velocity.y * delta;

  if (controls.getObject().position.y < 4) {
    velocity.y = 0;
    controls.getObject().position.y = 4;
    canJump = true;
  }

  handleCollisions();
}

function handleCollisions() {
  const playerObj = controls.getObject();
  const playerPosition = playerObj.position;
  const playerBox = new THREE.Box3().setFromCenterAndSize(playerPosition.clone().setY(playerPosition.y - 2), new THREE.Vector3(2, 6, 2));

  colliders.forEach((collider) => {
    if (collider.intersectsBox(playerBox)) {
      const colliderCenter = collider.getCenter(new THREE.Vector3());
      const push = playerPosition.clone().sub(colliderCenter).setY(0).normalize().multiplyScalar(0.5);
      playerPosition.add(push);
    }
  });
}

function animate() {
  requestAnimationFrame(animate);

  const time = performance.now();
  const delta = (time - prevTime) / 1000;
  prevTime = time;

  updateMovement(delta);
  updateInteractionPrompt();

  itemMeshes.forEach((mesh) => {
    mesh.rotation.y += delta;
    mesh.position.y = Math.sin(time * 0.002 + mesh.position.x) * 0.2 + 1.5;
  });

  renderer.render(scene, camera);
}

animate();
