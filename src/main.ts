import * as THREE from "three";
import World from "./World";
import { io } from "socket.io-client";
import InputManager from "./InputManager";

const socket = io("http://localhost:3000/");
const playerList = document.getElementById("player-list");

let localId: string | null = null;

type Player = {
  id: string;
  object: THREE.Mesh;
};

const networkPlayers = new Map<string, Player>();

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
    const minPitch = -Math.PI / 6;
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

  networkPlayers.set(socket.id!, { id: socket.id!, object: playerObject });

  const idElement = document.getElementById("server-id");
  if (idElement) idElement.innerHTML = `Player ID: ${socket.id}`;

  localId = socket.id!;
});

socket.on("addPlayer", (playerId: string) => {
  console.log("Adding player:", playerId);
  const playerObject = createPlayerMesh();
  scene.add(playerObject);
  networkPlayers.set(playerId, { id: playerId, object: playerObject });
});

socket.on("removePlayer", (playerId: string) => {
  console.log("Removing player:", playerId);
  const player = networkPlayers.get(playerId);
  if (!player) return;
  scene.remove(player.object);
  networkPlayers.delete(playerId);
});

socket.on("updatePlayers", (players: any) => {
  for (const [key, value] of Object.entries(players)) {
    let netPlayer = networkPlayers.get(key);
    if (!netPlayer) {
      const playerObject = createPlayerMesh();
      scene.add(playerObject);
      networkPlayers.set(key, { id: key, object: playerObject });
      netPlayer = networkPlayers.get(key)!;
    }
    const { position }: any = value;
    netPlayer.object.position.set(position.x, position.y, position.z);
  }
});

// Helper: make a player mesh
function createPlayerMesh() {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0xffffff * Math.random(),
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

  const playerForward = new THREE.Vector3(0, 0, 1);
  const angle = Math.atan2(cameraDirection.x, cameraDirection.z);

  if (inputManager.isMoving()) {
    player.object.rotation.y = angle;
    // const targetQuaternion = new THREE.Quaternion();
    // targetQuaternion.setFromEuler(new THREE.Euler(0, angle, 0));
    // player.object.quaternion.slerp(targetQuaternion, 0.1);
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
}
animate();

// Resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
