import * as THREE from "three";
import World from "./World";
import { io } from "socket.io-client";
import InputManager from "./InputManager";

const socket = io("http://192.168.1.102:3000/");
const idElement = document.getElementById("server-id");
const playerList = document.getElementById("player-list");
const playerPositionUI = document.getElementById("player-position");
const playerHealthUI = document.getElementById("player-health");
const playerCoinsUI = document.getElementById("player-coins");

let localId: string | null = null;

type ClientPlayer = {
  id: string;
  object: THREE.Mesh;
  health: number;
  coins: number;
};

type NetworkPlayer = {
  id: string;
  position: { x: number; y: number; z: number };
  quaternion: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  color: string;
  health: number;
};

const networkPlayers = new Map<string, ClientPlayer>();

let lastSentState = {};

// Scene
const scene = new THREE.Scene();

scene.background = new THREE.Color(0x95f2f5);

// Camera
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 2, 5);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// World
const world = new World(scene);
world.init();

// Camera control vars
let cameraYaw = 0;
let cameraPitch = 0;
const sensitivity = 0.002;

// Pointer lock
document.body.addEventListener("click", () => {
  renderer.domElement.requestPointerLock();
});

document.addEventListener("pointermove", (e) => {
  if (document.pointerLockElement === renderer.domElement) {
    cameraYaw -= e.movementX * sensitivity;
    cameraPitch -= e.movementY * sensitivity;

    const maxPitch = Math.PI / 3;
    const minPitch = -Math.PI / 12;
    cameraPitch = Math.max(minPitch, Math.min(maxPitch, cameraPitch));
  }
});

// Input manager
const inputManager = new InputManager();

// Networking
socket.on("connect", () => {
  console.log("Connected with server with id:", socket.id);

  const playerObject = createPlayerMesh();
  scene.add(playerObject);

  networkPlayers.set(socket.id!, {
    id: socket.id!,
    object: playerObject,
    health: 100,
    coins: 0,
  });

  if (idElement) idElement.innerHTML = `Player ID: ${socket.id}`;

  localId = socket.id!;
});

socket.on("initWorld", (data: any) => {
  world.initWorldData(data);
});

socket.on("zoneCreated", (data: any) => {
  world.createZone(data);
});

socket.on("zoneRemoved", (uuid: string) => {
  console.log("want to remove zone");
  world.removeByUUID(uuid);
});

socket.on("addPlayer", (playerId: string) => {
  console.log("Adding player:", playerId);
  const playerObject = createPlayerMesh();
  scene.add(playerObject);
  networkPlayers.set(playerId, {
    id: playerId,
    object: playerObject,
    health: 100,
    coins: 0,
  });
});

socket.on("removePlayer", (playerId: string) => {
  console.log("Removing player:", playerId);
  const player = networkPlayers.get(playerId);
  if (!player) return;
  scene.remove(player.object);
  networkPlayers.delete(playerId);
});

socket.on("updatePlayers", (players: NetworkPlayer) => {
  for (const [key, value] of Object.entries(players)) {
    let netPlayer = networkPlayers.get(key);
    if (!netPlayer) {
      const playerObject = createPlayerMesh();
      scene.add(playerObject);
      networkPlayers.set(key, {
        id: key,
        object: playerObject,
        health: 100,
        coins: 0,
      });
      netPlayer = networkPlayers.get(key)!;
    }

    // setting vals
    const { position, quaternion, color, health, coins }: any = value;

    //console.log(value);
    netPlayer.object.position.set(position.x, position.y, position.z);
    netPlayer.object.quaternion.set(
      quaternion.x,
      quaternion.y,
      quaternion.z,
      quaternion.w
    );

    const mat = netPlayer.object.material as THREE.MeshStandardMaterial;
    mat.color = new THREE.Color(color);

    netPlayer.health = health;
    netPlayer.coins = coins;
  }
});

function createPlayerMesh() {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      wireframe: false,
    })
  );

  mesh.castShadow = false;

  return mesh;
}

// Camera follow
function updateCameraFollow() {
  if (!localId) return;
  const player = networkPlayers.get(localId);
  if (!player) return;

  const playerPos = player.object.position;

  const distance = 5;
  const height = 1;

  const offsetX = distance * Math.sin(cameraYaw) * Math.cos(cameraPitch);
  const offsetY = height + distance * Math.sin(cameraPitch);
  const offsetZ = distance * Math.cos(cameraYaw) * Math.cos(cameraPitch);

  const desiredPosition = new THREE.Vector3(
    playerPos.x + offsetX,
    playerPos.y + offsetY,
    playerPos.z + offsetZ
  );

  // Smooth only the position change caused by player movement
  camera.position.lerp(desiredPosition, 1.0);

  camera.lookAt(playerPos.x, playerPos.y + height, playerPos.z);

  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);

  cameraDirection.y = 0;
  cameraDirection.normalize();
}

function updateUI() {
  if (!localId) return;

  if (playerList) {
    playerList.innerHTML = `Players Online: ${networkPlayers.size}`;
  }

  if (playerPositionUI) {
    const player = networkPlayers.get(localId);
    if (!player) return;

    playerPositionUI.innerHTML = `
    x: ${Math.floor(player.object.position.x)}
    y: ${Math.floor(player.object.position.y)}
    z: ${Math.floor(player.object.position.z)}
    `;

    if (playerHealthUI) {
      playerHealthUI.innerHTML = `${Math.floor(player.health)} HP`;
    }

    if (playerCoinsUI) {
      playerCoinsUI.innerHTML = `${player.coins} Coins`;
    }
  }
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // player
  if (!localId) return;
  const playerObject = networkPlayers.get(localId)?.object;
  if (!playerObject) return;

  const payload = {
    keys: inputManager.getState(),
    quaternion: camera.quaternion.clone(),
  };

  if (JSON.stringify(payload) !== JSON.stringify(lastSentState)) {
    socket.emit("playerInput", payload);
    lastSentState = payload;
  }

  world.update();
  updateCameraFollow();
  renderer.render(scene, camera);

  updateUI();
}
animate();

// Resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
