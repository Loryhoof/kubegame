import * as THREE from "three";
import World from "./World";
import { io } from "socket.io-client";
import InputManager from "./InputManager";

const socket = io("http://localhost:3000/");
const idElement = document.getElementById("server-id");
const playerList = document.getElementById("player-list");
const playerPositionUI = document.getElementById("player-position");
const playerHealthUI = document.getElementById("player-health");

let localId: string | null = null;

type ClientPlayer = {
  id: string;
  object: THREE.Mesh;
  health: number;
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
  });

  if (idElement) idElement.innerHTML = `Player ID: ${socket.id}`;

  localId = socket.id!;
});

socket.on("initWorld", (data: any) => {
  const { zones } = data;

  if (zones) {
    zones.forEach((zone: any) => {
      const { width, height, depth, position, quaternion, color } = zone;
      console.log(width, height, depth, position, quaternion, color);

      const zoneMesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(color),
          transparent: true,
          opacity: 0.4,
        })
      );

      const centerX = position.x + width / 2;
      const centerY = position.y + height / 2;
      const centerZ = position.z + depth / 2; // if 3D height, or z if in XZ plane

      // send centerX, centerY, centerZ to client as position

      zoneMesh.position.set(centerX, centerY, centerZ);
      zoneMesh.quaternion.set(
        quaternion.x,
        quaternion.y,
        quaternion.z,
        quaternion.w
      );

      scene.add(zoneMesh);
    });
  }
});

socket.on("addPlayer", (playerId: string) => {
  console.log("Adding player:", playerId);
  const playerObject = createPlayerMesh();
  scene.add(playerObject);
  networkPlayers.set(playerId, {
    id: playerId,
    object: playerObject,
    health: 100,
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
      networkPlayers.set(key, { id: key, object: playerObject, health: 100 });
      netPlayer = networkPlayers.get(key)!;
    }

    // setting vals
    const { position, quaternion, color, health }: any = value;

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
  }
});

// Helper: make a player mesh
function createPlayerMesh() {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      wireframe: false,
    })
  );

  mesh.castShadow = true;

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

  // console.log(payload);
  // console.log(JSON.stringify(payload));

  if (JSON.stringify(payload) !== JSON.stringify(lastSentState)) {
    socket.emit("playerInput", payload);
    lastSentState = payload;
    // console.log(payload);
  }

  world.update();
  updateCameraFollow();
  renderer.render(scene, camera);

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
  }
}
animate();

// Resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
