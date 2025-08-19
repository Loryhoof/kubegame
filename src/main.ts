import * as THREE from "three";
import World from "./World";
import InputManager from "./InputManager";
import ClientPlayer from "./ClientPlayer";
import { AssetsManager } from "./AssetsManager";
import { getRandomFromArray, isMobile } from "./utils";
import AudioManager from "./AudioManager";

import Stats from "stats.js";
import NetworkManager from "./NetworkManager";

const stats = new Stats();
// document.body.appendChild(stats.dom);

const idElement = document.getElementById("server-id");

const clock = new THREE.Clock();

let localId: string | null = null;

let worldIsReady = false;

type NetworkPlayer = {
  id: string;
  position: { x: number; y: number; z: number };
  quaternion: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  color: string;
  health: number;
};

let ping = 0;

const networkPlayers = new Map<string, ClientPlayer>();

let lastSentState = {};

// Scene
const scene = new THREE.Scene();

let wantsToInteract = false;

scene.background = new THREE.Color(0x95f2f5);

// Camera
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 2, 5);

AudioManager.instance.attachToCamera(camera);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
// renderer.setSize(window.innerWidth, window.innerHeight);

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

document.body.appendChild(renderer.domElement);

// World
const world = new World(scene);
world.init();

// Camera control vars

const mobileSens = 0.08;

let joystickX = 0;
let joystickY = 0;

// Input manager
const inputManager = InputManager.instance;
inputManager.setRenderer(renderer);

// Pointer lock

document.body.addEventListener("click", () => {
  renderer.domElement.requestPointerLock();
});

window.addEventListener("camera-controls", (e: any) => {
  const { x, y } = e.detail; // joystick input, typically -1 to 1

  joystickX = x;
  joystickY = y;
});

const socket = NetworkManager.instance.getSocket();

socket.on("connect_error", (err: any) => {
  console.error("Socket connection error:", err);
  const event = new CustomEvent("loading-status", {
    detail: {
      error: {
        title: "Connection error",
        info: "The server appears to be unreachable, please try again later",
      },
    },
  } as any);
  window.dispatchEvent(event);
});

// Networking
socket.on("connect", () => {
  console.log("Connected with server with id:", socket.id);

  localId = socket.id!;

  init();
});

setInterval(() => {
  const start = Date.now();
  socket.emit("pingCheck", start);
}, 3000);

// Listen for pong reply from server
socket.on("pongCheck", (startTime: number) => {
  ping = Date.now() - startTime;
});

socket.on("initWorld", (data: any) => {
  world.initWorldData(data);
});

socket.on("zoneCreated", (data: any) => {
  world.createZone(data);
});

socket.on("addVehicle", (data: any) => {
  world.addVehicle(data);
});

socket.on("interactableCreated", (data: any) => {
  world.createInteractable(data);
});

socket.on("zoneRemoved", (uuid: string) => {
  world.removeByUUID(uuid);
});

socket.on("interactableRemoved", (uuid: string) => {
  AudioManager.instance.playAudio("pickup", 0.1);
  world.removeInteractableByUUID(uuid);
});

socket.on("vehicleRemoved", (uuid: string) => {
  world.removeVehicleByUUID(uuid);
});

type UserActionData = {
  id: string;
  type: string;
  hasHit: boolean;
};

socket.on("user_action", (data: UserActionData) => {
  if (data.type == "attack") {
    //attackAnim.stop();
    //attackAnim.play();

    const player = networkPlayers.get(data.id);
    if (!player) return;

    const animList = ["MeleeMotion", "MeleeMotion_2"];

    player.playAnimation(getRandomFromArray(animList));

    if (data.hasHit) {
      AudioManager.instance.playAudio("punch_impact", 0.5);
    }
    //player.playAnimation("Melee", THREE.LoopOnce);
  }
});

socket.on("addPlayer", (playerId: string) => {
  const newPlayer = new ClientPlayer(playerId, "0xffffff", scene);

  networkPlayers.set(playerId, newPlayer);
});

socket.on("removePlayer", (playerId: string) => {
  const player = networkPlayers.get(playerId);
  if (!player) return;
  player.remove();
  networkPlayers.delete(playerId);
});

type UpdateData = {
  world: any;
  players: NetworkPlayer;
};

socket.on("updateData", (data: UpdateData) => {
  if (!worldIsReady) return;

  for (const [key, value] of Object.entries(data.players)) {
    let netPlayer = networkPlayers.get(key);

    if (!netPlayer) {
      const newPlayer = new ClientPlayer(socket.id!, "0xffffff", scene);
      networkPlayers.set(key, newPlayer);
      netPlayer = networkPlayers.get(key)!;
    }

    if (!netPlayer) {
      console.log("no netplayer", socket.id);
      return;
    }

    netPlayer.setState(value as any);
  }

  world.updateState(data.world);
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

  const playerPos = player.getPosition();
  const distance = InputManager.instance.cameraDistance;
  const height = 1;

  // Sitting locked cam (unless right mouse is pressed)
  // if (player.isSitting && !InputManager.instance.isKeyPressed("mouseRight")) {
  //   const localOffset = new THREE.Vector3(0, 3, 6);
  //   const offsetWorld = localOffset
  //     .clone()
  //     .applyQuaternion(player.getQuaternion());

  //   const playerPosSmoothed = new THREE.Vector3().lerpVectors(
  //     camera.position.clone().sub(offsetWorld),
  //     player.getPosition(),
  //     0.98
  //   );

  //   const targetPos = playerPosSmoothed.clone().add(offsetWorld);

  //   camera.position.lerp(targetPos, 0.1); // smaller lerp factor for smoother movement
  //   //camera.position.copy(targetPos);
  //   camera.lookAt(
  //     playerPosSmoothed.x,
  //     playerPosSmoothed.y + 1,
  //     playerPosSmoothed.z
  //   );

  //   return;
  // }

  // Orbit / Freecam
  if (isMobile()) {
    InputManager.instance.cameraYaw -= joystickX * mobileSens;
    InputManager.instance.cameraPitch -= joystickY * mobileSens;
  }

  const maxPitch = Math.PI / 3;
  const minPitch = -Math.PI / 12;
  InputManager.instance.cameraPitch = Math.max(
    minPitch,
    Math.min(maxPitch, InputManager.instance.cameraPitch)
  );

  const offsetX =
    distance *
    Math.sin(InputManager.instance.cameraYaw) *
    Math.cos(InputManager.instance.cameraPitch);
  const offsetY =
    height + distance * Math.sin(InputManager.instance.cameraPitch);
  const offsetZ =
    distance *
    Math.cos(InputManager.instance.cameraYaw) *
    Math.cos(InputManager.instance.cameraPitch);

  const desiredPosition = new THREE.Vector3(
    playerPos.x + offsetX,
    playerPos.y + offsetY,
    playerPos.z + offsetZ
  );

  camera.position.lerp(desiredPosition, 1);
  camera.lookAt(playerPos.x, playerPos.y + height, playerPos.z);
}

// function updateUI() {
//   if (!localId) return;

//   if (playerList) {
//     playerList.innerHTML = `Players Online: ${networkPlayers.size}`;
//   }

//   if (playerPositionUI) {
//     const player = networkPlayers.get(localId);
//     if (!player) return;

//     playerPositionUI.innerHTML = `
//     x: ${Math.floor(player.getPosition().x)}
//     y: ${Math.floor(player.getPosition().y)}
//     z: ${Math.floor(player.getPosition().z)}
//     `;

//     if (playerHealthUI) {
//       playerHealthUI.innerHTML = `${Math.floor(player.health)} HP`;
//     }

//     if (playerCoinsUI) {
//       playerCoinsUI.innerHTML = `${player.coins} Coins`;
//     }
//   }
// }

function updateUI() {
  if (!localId) return;

  const player = networkPlayers.get(localId);

  const eventData = {
    networkId: localId,
    position: {
      x: player?.getPosition().x,
      y: player?.getPosition().y,
      z: player?.getPosition().z,
    },
    health: player?.health,
    coins: player?.coins,
    playerCount: networkPlayers.size,
    ping: ping,
  };

  const event = new CustomEvent("player-update", { detail: eventData } as any);
  window.dispatchEvent(event);

  const interactData = {
    wantsToInteract: wantsToInteract,
  };

  const interactEvent = new CustomEvent("ui-update", {
    detail: interactData,
  });
  window.dispatchEvent(interactEvent);
}

// Animation loop
function animate() {
  //requestAnimationFrame(animate);
  stats.begin();

  const delta = clock.getDelta();

  // player
  if (!localId) return;
  const playerObject = networkPlayers.get(localId);
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

  networkPlayers.forEach((player: ClientPlayer) => {
    player.update(delta);
  });

  const localPlayer = networkPlayers.get(localId);

  if (localPlayer) {
    checkPlayerInteractables(localPlayer);
  }

  renderer.render(scene, camera);

  stats.end();
  updateUI();
  InputManager.instance.update();

  requestAnimationFrame(animate);
}

function checkPlayerInteractables(player: ClientPlayer) {
  let closestInteractable = null;
  let minDist = Infinity;

  type InteractableType = { id: string; mesh: THREE.Mesh };

  const interactables = world.interactables as InteractableType[];

  for (const interactable of interactables) {
    const dist = player.getPosition().distanceTo(interactable.mesh.position);
    if (dist < minDist) {
      minDist = dist;
      closestInteractable = interactable;
    }
  }

  if (minDist <= 1.5) {
    wantsToInteract = true;
  } else {
    wantsToInteract = false;
  }
}

async function init() {
  const assetsManager = AssetsManager.instance;
  await assetsManager.loadAll();

  const player = new ClientPlayer(socket.id!, "0xffffff", scene, true);

  if (!socket.id) {
    console.log("no socket id i.e. no connection");
    return;
  }

  networkPlayers.set(socket.id, player);

  // if (idElement) idElement.innerHTML = `Player ID: ${socket.id}`;

  animate();

  const event = new CustomEvent("loading-status", {
    detail: { ready: true },
  } as any);
  window.dispatchEvent(event);

  setTimeout(() => {
    worldIsReady = true;
    socket.emit("readyForWorld");
  }, 2000);
}

function resizeRenderer() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Resize
window.addEventListener("resize", () => {
  resizeRenderer();
  // camera.aspect = window.innerWidth / window.innerHeight;
  // camera.updateProjectionMatrix();
  // renderer.setSize(window.innerWidth, window.innerHeight);
});
