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

const worldRoot = new THREE.Group();
scene.add(worldRoot);

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
let worldInitialized = false;

setupScene();
initQuestUI();

startButton.addEventListener('click', () => {
  if (!worldInitialized) {
    buildWorld();
  }
  startScreen.classList.add('hidden');
  hud.classList.remove('hidden');
  controls.lock();
});

controls.addEventListener('lock', () => {
  if (!worldInitialized) {
    buildWorld();
  }
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

function setupScene() {
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

  scene.add(controls.getObject());
  controls.getObject().position.set(0, 5, 18);
}

function buildWorld() {
  if (worldInitialized) return;

  worldRoot.clear();
  colliders.length = 0;
  interactables.length = 0;
  itemMeshes.length = 0;

  createTerrain();
  createPaths();
  createTown();
  createMarketplace();
  createFarmland();
  createForest();
  createWater();
  createRocks();
  createProps();
  createNPCs();

  worldInitialized = true;
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
  worldRoot.add(terrain);
}

function createPaths() {
  const pathGroup = new THREE.Group();
  const pathMaterial = new THREE.MeshStandardMaterial({ color: 0x6e5a3b, roughness: 0.95 });

  const mainRoad = new THREE.Mesh(new THREE.PlaneGeometry(8, 80), pathMaterial);
  mainRoad.rotation.x = -Math.PI / 2;
  mainRoad.position.set(0, 0.12, -20);
  mainRoad.receiveShadow = true;
  pathGroup.add(mainRoad);

  const plazaPath = new THREE.Mesh(new THREE.RingGeometry(12, 18, 32, 1, Math.PI / 4, Math.PI * 1.5), pathMaterial);
  plazaPath.rotation.x = -Math.PI / 2;
  plazaPath.position.y = 0.11;
  pathGroup.add(plazaPath);

  const forestTrail = new THREE.Mesh(new THREE.PlaneGeometry(5, 60), pathMaterial);
  forestTrail.rotation.x = -Math.PI / 2;
  forestTrail.position.set(10, 0.11, 40);
  forestTrail.rotation.y = 0.2;
  pathGroup.add(forestTrail);

  const pondTrail = new THREE.Mesh(new THREE.PlaneGeometry(4, 40), pathMaterial);
  pondTrail.rotation.x = -Math.PI / 2;
  pondTrail.position.set(-24, 0.11, 16);
  pondTrail.rotation.y = -0.4;
  pathGroup.add(pondTrail);

  worldRoot.add(pathGroup);
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
    new THREE.Vector3(16, 0, -18),
    new THREE.Vector3(-24, 0, 10),
    new THREE.Vector3(26, 0, -12)
  ];

  housePositions.forEach((position, index) => {
    const house = buildHouse(position, index % 2 === 0 ? 1 : -1);
    townCenter.add(house);
    house.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(house);
    colliders.push(box);
  });

  const tavern = buildTavern();
  tavern.position.set(-4, 0, -16);
  townCenter.add(tavern);
  tavern.updateMatrixWorld(true);
  colliders.push(new THREE.Box3().setFromObject(tavern));

  const watchTower = buildWatchTower();
  watchTower.position.set(30, 0, 22);
  townCenter.add(watchTower);
  watchTower.updateMatrixWorld(true);
  colliders.push(new THREE.Box3().setFromObject(watchTower));

  const walls = buildTownWalls();
  townCenter.add(walls);

  worldRoot.add(townCenter);
}

function createMarketplace() {
  const market = new THREE.Group();
  const stallPositions = [
    { position: new THREE.Vector3(-10, 0, 6), rotation: Math.PI / 6 },
    { position: new THREE.Vector3(8, 0, 10), rotation: -Math.PI / 4 },
    { position: new THREE.Vector3(10, 0, -8), rotation: Math.PI / 3 }
  ];

  stallPositions.forEach((entry, index) => {
    const stall = buildMarketStall(index);
    stall.position.copy(entry.position);
    stall.rotation.y = entry.rotation;
    market.add(stall);
    stall.updateMatrixWorld(true);
    colliders.push(new THREE.Box3().setFromObject(stall));
  });

  worldRoot.add(market);
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

  const windowMaterial = new THREE.MeshStandardMaterial({ color: 0xdec58a, emissive: 0x30200f, emissiveIntensity: 0.3 });
  const windowPositions = [
    new THREE.Vector3(3.2, 3.2, 4.05),
    new THREE.Vector3(-3.2, 3.2, 4.05),
    new THREE.Vector3(4.9, 3.2, 2),
    new THREE.Vector3(-4.9, 3.2, -2)
  ];
  windowPositions.forEach((pos) => {
    const window = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.6), windowMaterial);
    window.position.copy(pos);
    if (Math.abs(pos.z) > 3.9) {
      window.rotation.y = Math.PI;
    } else {
      window.rotation.y = Math.PI / 2 * Math.sign(pos.x);
    }
    houseGroup.add(window);
  });

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

function buildTavern() {
  const tavern = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(14, 7, 10),
    new THREE.MeshStandardMaterial({ color: 0x7b5030, roughness: 0.7 })
  );
  base.position.y = 3.5;
  base.castShadow = true;
  base.receiveShadow = true;
  tavern.add(base);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(9, 5, 6),
    new THREE.MeshStandardMaterial({ color: 0x3a1f12, roughness: 0.8 })
  );
  roof.position.y = 8;
  roof.rotation.y = Math.PI / 6;
  roof.castShadow = true;
  tavern.add(roof);

  const signPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 6, 8),
    new THREE.MeshStandardMaterial({ color: 0x5a3b22, roughness: 0.8 })
  );
  signPost.position.set(7, 3, 4.6);
  tavern.add(signPost);

  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(3, 2, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xd4b26b, roughness: 0.6 })
  );
  signBoard.position.set(7, 4.5, 6);
  tavern.add(signBoard);

  return tavern;
}

function buildWatchTower() {
  const tower = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 3.5, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x6d5137, roughness: 0.85 })
  );
  base.position.y = 6;
  base.castShadow = true;
  base.receiveShadow = true;
  tower.add(base);

  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 4, 2.4, 16),
    new THREE.MeshStandardMaterial({ color: 0x4f3723, roughness: 0.8 })
  );
  top.position.y = 12.6;
  tower.add(top);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(4.8, 3, 8),
    new THREE.MeshStandardMaterial({ color: 0x311f14, roughness: 0.8 })
  );
  roof.position.y = 14.6;
  tower.add(roof);

  const torch = new THREE.PointLight(0xffc477, 1, 30);
  torch.position.set(0, 13, 3);
  torch.castShadow = true;
  tower.add(torch);

  return tower;
}

function buildMarketStall(index) {
  const stall = new THREE.Group();

  const colors = [0xc9694a, 0x4f7d8a, 0x8a4f7d];
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(6, 0.4, 4),
    new THREE.MeshStandardMaterial({ color: colors[index % colors.length], roughness: 0.5 })
  );
  canopy.position.y = 3.4;
  canopy.castShadow = true;
  stall.add(canopy);

  for (let i = 0; i < 4; i++) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 3.4, 6),
      new THREE.MeshStandardMaterial({ color: 0x5a3b22, roughness: 0.8 })
    );
    const offsetX = i < 2 ? -2.6 : 2.6;
    const offsetZ = i % 2 === 0 ? -1.6 : 1.6;
    post.position.set(offsetX, 1.7, offsetZ);
    stall.add(post);
  }

  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(6, 0.8, 3.2),
    new THREE.MeshStandardMaterial({ color: 0x7d5a36, roughness: 0.9 })
  );
  counter.position.y = 1.1;
  stall.add(counter);

  for (let i = 0; i < 4; i++) {
    const goods = new THREE.Mesh(
      new THREE.SphereGeometry(0.4 + Math.random() * 0.2, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xf4c16e, roughness: 0.7 })
    );
    goods.position.set(-1.5 + i, 1.7, (i % 2 === 0 ? -0.6 : 0.6));
    stall.add(goods);
  }

  return stall;
}

function buildBarn() {
  const barn = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(14, 6, 10),
    new THREE.MeshStandardMaterial({ color: 0x8b3e2f, roughness: 0.8 })
  );
  base.position.y = 3;
  base.castShadow = true;
  base.receiveShadow = true;
  barn.add(base);

  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(8, 8, 12, 4, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x4a2015, roughness: 0.9, side: THREE.DoubleSide })
  );
  roof.rotation.z = Math.PI / 2;
  roof.position.y = 7;
  barn.add(roof);

  const door = new THREE.Mesh(
    new THREE.BoxGeometry(4, 4, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x5b2b1a, roughness: 0.8 })
  );
  door.position.set(0, 2, 5.15);
  barn.add(door);

  return barn;
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
  const treeCount = 110;
  for (let i = 0; i < treeCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 60 + Math.random() * 90;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const tree = buildTree();
    tree.position.set(x, 0, z);
    worldRoot.add(tree);
    tree.updateMatrixWorld(true);
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
    worldRoot.add(herb);
    interactables.push({
      type: 'item',
      questId: 'moonherb',
      mesh: herb,
      itemName: 'Moonherb',
      amount: 1,
      prompt: 'Press E to gather the Moonherb'
    });
    itemMeshes.push(herb);
  });

  const ancientTree = buildTree(2.2);
  ancientTree.scale.set(1.4, 1.4, 1.4);
  ancientTree.position.set(-88, 0, -12);
  worldRoot.add(ancientTree);
  ancientTree.updateMatrixWorld(true);
  colliders.push(new THREE.Box3().setFromObject(ancientTree));

  const campfire = buildForestCamp();
  campfire.position.set(54, 0, 68);
  worldRoot.add(campfire);
  campfire.updateMatrixWorld(true);
  colliders.push(new THREE.Box3().setFromObject(campfire));
}

function createFarmland() {
  const farmland = new THREE.Group();

  const soilMaterial = new THREE.MeshStandardMaterial({ color: 0x3a2a1f, roughness: 0.95 });
  const cropMaterial = new THREE.MeshStandardMaterial({ color: 0x4f7f3b, roughness: 0.8 });

  const plot = new THREE.Mesh(new THREE.PlaneGeometry(18, 24), soilMaterial);
  plot.rotation.x = -Math.PI / 2;
  plot.position.set(34, 0.1, 26);
  plot.receiveShadow = true;
  farmland.add(plot);

  for (let i = -4; i <= 4; i++) {
    const row = new THREE.Mesh(new THREE.BoxGeometry(18, 0.2, 0.4), cropMaterial);
    row.position.set(34, 0.3, 26 + i * 2);
    farmland.add(row);
  }

  const orchard = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const sapling = buildTree(0.4);
    sapling.scale.set(0.6, 0.6, 0.6);
    sapling.position.set(46 + Math.sin(i) * 2, 0, 20 + i * 4);
    orchard.add(sapling);
    sapling.updateMatrixWorld(true);
    colliders.push(new THREE.Box3().setFromObject(sapling));
  }
  farmland.add(orchard);

  const barn = buildBarn();
  barn.position.set(42, 0, 34);
  farmland.add(barn);
  barn.updateMatrixWorld(true);
  colliders.push(new THREE.Box3().setFromObject(barn));

  const fences = [
    new THREE.Vector3(34, 0.8, 38),
    new THREE.Vector3(34, 0.8, 14)
  ];
  fences.forEach((pos, idx) => {
    const fence = new THREE.Mesh(
      new THREE.BoxGeometry(22, 1.4, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x76532c, roughness: 0.8 })
    );
    fence.position.copy(pos);
    farmland.add(fence);
    fence.updateMatrixWorld(true);
    colliders.push(new THREE.Box3().setFromObject(fence));
  });

  const sideFences = [
    { position: new THREE.Vector3(23, 0.8, 26), rotation: Math.PI / 2 },
    { position: new THREE.Vector3(45, 0.8, 26), rotation: Math.PI / 2 }
  ];
  sideFences.forEach((entry) => {
    const fence = new THREE.Mesh(
      new THREE.BoxGeometry(24, 1.4, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x6a4524, roughness: 0.8 })
    );
    fence.position.copy(entry.position);
    fence.rotation.y = entry.rotation;
    farmland.add(fence);
    fence.updateMatrixWorld(true);
    colliders.push(new THREE.Box3().setFromObject(fence));
  });

  const scarecrow = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.2, 4, 6),
    new THREE.MeshStandardMaterial({ color: 0x8d6d3b, roughness: 0.8 })
  );
  pole.position.y = 2;
  scarecrow.add(pole);

  const crossBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 3.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x8d6d3b, roughness: 0.8 })
  );
  crossBar.rotation.z = Math.PI / 2;
  crossBar.position.y = 2.4;
  scarecrow.add(crossBar);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xe6d0a8, roughness: 0.9 })
  );
  head.position.y = 3.4;
  scarecrow.add(head);

  scarecrow.position.set(34, 0, 26);
  farmland.add(scarecrow);
  scarecrow.updateMatrixWorld(true);
  colliders.push(new THREE.Box3().setFromObject(scarecrow));

  worldRoot.add(farmland);
}

function buildTree(trunkRadius = 0.6) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(trunkRadius, trunkRadius + 0.2, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x4b2e1e, roughness: 1 })
  );
  trunk.position.y = 4;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  tree.add(trunk);

  const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x224d1f, roughness: 0.8 });
  const layers = 3;
  for (let i = 0; i < layers; i++) {
    const radius = 4 - i + Math.random() * 0.6;
    const height = 4 + Math.random() * 0.5;
    const foliage = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 8), foliageMaterial);
    foliage.position.y = 6 + i * 2.5;
    foliage.castShadow = true;
    foliage.receiveShadow = true;
    tree.add(foliage);
  }

  return tree;
}

function buildForestCamp() {
  const camp = new THREE.Group();
  const clearing = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6, 0.2, 16),
    new THREE.MeshStandardMaterial({ color: 0x3d2f1f, roughness: 0.9 })
  );
  clearing.rotation.x = Math.PI / 2;
  clearing.receiveShadow = true;
  camp.add(clearing);

  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x5d3b25, roughness: 0.8 })
    );
    log.rotation.z = Math.PI / 2;
    const angle = (i / 4) * Math.PI * 2;
    log.position.set(Math.cos(angle) * 2.4, 0.8, Math.sin(angle) * 2.4);
    log.castShadow = true;
    camp.add(log);
  }

  const fire = new THREE.Mesh(
    new THREE.ConeGeometry(1.2, 2.4, 12),
    new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff7f2a, emissiveIntensity: 0.8 })
  );
  fire.position.y = 1.4;
  camp.add(fire);

  const fireLight = new THREE.PointLight(0xffb347, 1.2, 28, 2);
  fireLight.position.set(0, 3, 0);
  camp.add(fireLight);

  return camp;
}

function createWater() {
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(16, 32),
    new THREE.MeshStandardMaterial({ color: 0x1e3d5d, transparent: true, opacity: 0.8, metalness: 0.6, roughness: 0.2 })
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(-32, 0.11, 24);
  worldRoot.add(pond);

  const dock = new THREE.Mesh(
    new THREE.BoxGeometry(2, 0.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x5a4330, roughness: 0.7 })
  );
  dock.position.set(-32, 0.8, 14);
  dock.castShadow = true;
  dock.receiveShadow = true;
  worldRoot.add(dock);
  dock.updateMatrixWorld(true);
  colliders.push(new THREE.Box3().setFromObject(dock));

  const reeds = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const reed = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 3 + Math.random(), 5),
      new THREE.MeshStandardMaterial({ color: 0x3f6b3e, roughness: 0.9 })
    );
    const angle = Math.random() * Math.PI * 2;
    const radius = 12 + Math.random() * 2;
    reed.position.set(Math.cos(angle) * radius - 32, 1.5, Math.sin(angle) * radius + 24);
    reeds.add(reed);
  }
  worldRoot.add(reeds);
}

function createRocks() {
  const rocks = new THREE.Group();
  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x5a534d, roughness: 0.95 });

  for (let i = 0; i < 22; i++) {
    const geometry = new THREE.DodecahedronGeometry(1.2 + Math.random() * 1.4);
    const rock = new THREE.Mesh(geometry, rockMaterial.clone());
    const angle = Math.random() * Math.PI * 2;
    const radius = 70 + Math.random() * 80;
    rock.position.set(Math.cos(angle) * radius, 0.6, Math.sin(angle) * radius);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    rock.receiveShadow = true;
    rocks.add(rock);
    colliders.push(new THREE.Box3().setFromObject(rock));
  }

  worldRoot.add(rocks);
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
  worldRoot.add(forge);
  forge.updateMatrixWorld(true);
  colliders.push(new THREE.Box3().setFromObject(forge));

  const ingot = createCollectible({
    name: 'Sky-Steel Ingot',
    questId: 'ingot',
    description: 'A rare ingot forged from star metal, humming with magical energy.'
  });
  ingot.position.set(12, 2.5, -0.5);
  worldRoot.add(ingot);
  interactables.push({
    type: 'item',
    questId: 'ingot',
    mesh: ingot,
    itemName: 'Sky-Steel Ingot',
    amount: 1,
    prompt: 'Press E to recover the Sky-Steel'
  });
  itemMeshes.push(ingot);

  const cart = new THREE.Mesh(
    new THREE.BoxGeometry(6, 2, 4),
    new THREE.MeshStandardMaterial({ color: 0x5c482f, roughness: 0.8 })
  );
  cart.position.set(-6, 1, 6);
  cart.castShadow = true;
  cart.receiveShadow = true;
  worldRoot.add(cart);
  cart.updateMatrixWorld(true);
  colliders.push(new THREE.Box3().setFromObject(cart));

  const well = new THREE.Group();
  const wellBase = new THREE.Mesh(
    new THREE.CylinderGeometry(2, 2, 1.6, 16),
    new THREE.MeshStandardMaterial({ color: 0x6e6861, roughness: 0.9 })
  );
  wellBase.position.y = 0.8;
  wellBase.castShadow = true;
  wellBase.receiveShadow = true;
  well.add(wellBase);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(2.4, 2, 12),
    new THREE.MeshStandardMaterial({ color: 0x7b4a2b, roughness: 0.8 })
  );
  roof.position.y = 3.2;
  well.add(roof);

  const posts = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 3, 6),
    new THREE.MeshStandardMaterial({ color: 0x4f3a24, roughness: 0.7 })
  );
  posts.scale.set(1, 1, 3.4);
  posts.position.y = 2.2;
  well.add(posts);

  well.position.set(4, 0, 10);
  worldRoot.add(well);
  well.updateMatrixWorld(true);
  colliders.push(new THREE.Box3().setFromObject(well));

  const crates = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 1.8, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x8a6136, roughness: 0.9 })
    );
    crate.position.set(i % 2 === 0 ? -2 : -4, 0.9 + Math.floor(i / 3) * 1.9, 12 + (i % 3));
    crate.castShadow = true;
    crate.receiveShadow = true;
    crates.add(crate);
  }
  worldRoot.add(crates);
  crates.updateMatrixWorld(true);
  colliders.push(new THREE.Box3().setFromObject(crates));
}

function createNPCs() {
  const captain = buildNPC({ robeColor: 0x2b355a, accentColor: 0xf1d7b0, accessory: 'staff' });
  captain.position.set(2, 0, 0);
  worldRoot.add(captain);
  interactables.push({
    type: 'npc',
    questId: 'report',
    mesh: captain,
    name: 'Captain Aranth',
    prompt: 'Press E to report to Captain Aranth',
    onInteract: () => {
      if (isQuestObjectiveComplete('moonherb') && isQuestObjectiveComplete('ingot')) {
        completeObjective('report');
        finishQuest();
      } else {
        showMessage('Captain Aranth: "Gather the moonherbs and recover the sky-steel ingot before you return."');
      }
    }
  });

  const herbalist = buildNPC({ robeColor: 0x265f3a, accentColor: 0xe8c599, accessory: 'satchel' });
  herbalist.position.set(36, 0, -6);
  worldRoot.add(herbalist);
  interactables.push({
    type: 'npc',
    mesh: herbalist,
    name: 'Mira the Herbalist',
    prompt: 'Press E to speak with Mira',
    onInteract: () => {
      showMessage('Mira: "Moonherbs glow brightest under the pines north of town. Follow the fireflies and you cannot miss them."');
    }
  });

  const blacksmith = buildNPC({ robeColor: 0x3a2a20, accentColor: 0xd7b28c, accessory: 'hammer' });
  blacksmith.position.set(14, 0, -6);
  worldRoot.add(blacksmith);
  interactables.push({
    type: 'npc',
    mesh: blacksmith,
    name: 'Jorlan the Smith',
    prompt: 'Press E to speak with Jorlan',
    onInteract: () => {
      showMessage("Jorlan: \"If you find my sky-steel, the caravan will ride with Aventuria's blessings.\"");
    }
  });

  const traveler = buildNPC({ robeColor: 0x4a3a5a, accentColor: 0xf1d7b0, accessory: 'scroll' });
  traveler.position.set(0, 0, 34);
  worldRoot.add(traveler);
  interactables.push({
    type: 'npc',
    mesh: traveler,
    name: 'Lysa the Cartographer',
    prompt: "Press E to hear Lysa's tales",
    onInteract: () => {
      showMessage('Lysa: "Beyond the palisades lie ruins swallowed by the forest. Perhaps you will chart them for the guild."');
    }
  });
}

function buildNPC({ robeColor, accentColor, accessory }) {
  const npc = new THREE.Group();

  const robe = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 4.2, 12),
    new THREE.MeshStandardMaterial({ color: robeColor, roughness: 0.65 })
  );
  robe.position.y = 2.1;
  robe.castShadow = true;
  robe.receiveShadow = true;
  npc.add(robe);

  const shoulders = new THREE.Mesh(
    new THREE.TorusGeometry(1.1, 0.25, 8, 16),
    new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.5 })
  );
  shoulders.rotation.x = Math.PI / 2;
  shoulders.position.y = 3.4;
  npc.add(shoulders);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 18, 18),
    new THREE.MeshStandardMaterial({ color: 0xf1d7b0, roughness: 0.7 })
  );
  head.position.y = 4.6;
  npc.add(head);

  if (accessory === 'staff') {
    const staff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.25, 5.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x8d6d3b, roughness: 0.7 })
    );
    staff.position.set(1, 3, 0.6);
    npc.add(staff);
  }

  if (accessory === 'satchel') {
    const strap = new THREE.Mesh(
      new THREE.TorusGeometry(1.6, 0.12, 6, 16, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x3c2b1b, roughness: 0.8 })
    );
    strap.rotation.z = Math.PI / 3;
    strap.position.set(-0.6, 3.2, 0.6);
    npc.add(strap);

    const bag = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x5c432a, roughness: 0.9 })
    );
    bag.position.set(-0.9, 2.4, 1.2);
    npc.add(bag);
  }

  if (accessory === 'hammer') {
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 3.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x5c4025, roughness: 0.8 })
    );
    handle.rotation.z = Math.PI / 2;
    handle.position.set(1.6, 2.6, -0.4);
    npc.add(handle);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.6, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x444343, metalness: 0.6, roughness: 0.5 })
    );
    head.position.set(2.5, 2.6, -0.4);
    npc.add(head);
  }

  if (accessory === 'scroll') {
    const scroll = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 1.6, 8),
      new THREE.MeshStandardMaterial({ color: 0xe3d4af, roughness: 0.7 })
    );
    scroll.rotation.x = Math.PI / 2;
    scroll.position.set(-1.1, 3.2, 0.4);
    npc.add(scroll);
  }

  npc.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return npc;
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
    interactionLabel.textContent = target.prompt || (target.type === 'npc' ? 'Press E to speak' : 'Press E to collect');
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
