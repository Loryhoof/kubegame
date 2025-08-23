import * as THREE from "three";
import World from "./World";
import InputManager from "./InputManager";
import ClientPlayer from "./ClientPlayer";
import { AssetsManager } from "./AssetsManager";
import { getRandomFromArray, isMobile } from "./utils";
import AudioManager from "./AudioManager";

import Stats from "stats.js";
import NetworkManager from "./NetworkManager";
import ChatManager from "./ChatManager";

const stats = new Stats();
// document.body.appendChild(stats.dom);

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
let lastSentState: any = {};

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
AudioManager.instance.attachToCamera(camera);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Input manager
const inputManager = InputManager.instance;
inputManager.setRenderer(renderer);

// Pointer lock
document.body.addEventListener("click", () => {
  renderer.domElement.requestPointerLock();
});

// Mobile joystick control
const mobileSens = 0.08;
let joystickX = 0;
let joystickY = 0;
window.addEventListener("camera-controls", (e: any) => {
  const { x, y } = e.detail;
  joystickX = x;
  joystickY = y;
});

// Networking
const socket = NetworkManager.instance.getSocket();

// ✅ Do not bind listeners immediately — only after init()
function registerSocketEvents(world: World) {
  setInterval(() => {
    const start = Date.now();
    socket.emit("pingCheck", start);
  }, 3000);

  socket.on("pongCheck", (startTime: number) => {
    ping = Date.now() - startTime;
  });

  socket.on("initWorld", (data: any) => {
    world.initWorldData(data);
  });

  socket.on("init-chat", (data: any) => {
    ChatManager.instance.init(data && data.messages ? data.messages : []);
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

  socket.on(
    "user_action",
    (data: { id: string; type: string; hasHit: boolean }) => {
      if (data.type == "attack") {
        const player = networkPlayers.get(data.id);
        if (!player) return;

        const animList = ["MeleeMotion", "MeleeMotion_2"];
        player.playAnimation(getRandomFromArray(animList));

        if (data.hasHit) {
          AudioManager.instance.playAudio("punch_impact", 0.5);
        }
      }
    }
  );

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

  socket.on(
    "updateData",
    (data: { world: any; players: Record<string, NetworkPlayer> }) => {
      if (!worldIsReady) return;

      for (const [key, value] of Object.entries(data.players)) {
        let netPlayer = networkPlayers.get(key);

        if (!netPlayer) {
          const newPlayer = new ClientPlayer(key, "0xffffff", scene);
          networkPlayers.set(key, newPlayer);
          netPlayer = newPlayer;
        }

        netPlayer.setState(value as any);
      }

      world.updateState(data.world);
    }
  );
}

// Camera follow
function updateCameraFollow() {
  if (!localId) return;
  const player = networkPlayers.get(localId);
  if (!player) return;

  const playerPos = player.getPosition();
  const distance = InputManager.instance.cameraDistance;
  const height = 1;

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

// Interactables
function checkPlayerInteractables(player: ClientPlayer, world: World) {
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

  return minDist <= 1.5;
}

// UI updates
function updateUI(player: ClientPlayer, wantsToInteract: boolean) {
  const eventData = {
    networkId: localId,
    position: player.getPosition(),
    health: player.health,
    coins: player.coins,
    playerCount: networkPlayers.size,
    ping: ping,
  };

  const event = new CustomEvent("player-update", { detail: eventData } as any);
  window.dispatchEvent(event);

  const interactEvent = new CustomEvent("ui-update", {
    detail: { wantsToInteract },
  });
  window.dispatchEvent(interactEvent);
}

// Main animation loop
function animate(world: World) {
  stats.begin();
  const delta = clock.getDelta();

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

  world.update(delta);
  updateCameraFollow();

  networkPlayers.forEach((player: ClientPlayer) => {
    player.update(delta);
  });

  if (playerObject) {
    const wantsToInteract = checkPlayerInteractables(playerObject, world);
    updateUI(playerObject, wantsToInteract);
  }

  renderer.render(scene, camera);

  stats.end();
  inputManager.update();

  requestAnimationFrame(() => animate(world));
}

// Init
async function init() {
  const assetsManager = AssetsManager.instance;
  await assetsManager.loadAll();

  const world = new World(scene);
  world.init();

  if (!socket.id) {
    console.log("no socket id i.e. no connection");
    return;
  }

  localId = socket.id;
  const player = new ClientPlayer(localId, "0xffffff", scene, true);
  networkPlayers.set(localId, player);

  registerSocketEvents(world);
  animate(world);

  const event = new CustomEvent("loading-status", {
    detail: { ready: true },
  } as any);
  window.dispatchEvent(event);

  setTimeout(() => {
    worldIsReady = true;
    socket.emit("readyForWorld");
  }, 2000);
}

// Resize handling
function resizeRenderer() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resizeRenderer);

// Only run init AFTER socket connects
socket.on("connect", () => {
  console.log("Connected with server with id:", socket.id);
  init();
});

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
