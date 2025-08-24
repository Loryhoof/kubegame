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
import ClientVehicle from "./ClientVehicle";
import CameraManager from "./CameraManager";

let world: World | null = null;

type Snapshot = {
  time: number; // server time of snapshot (ms)
  players: Record<string, NetworkPlayer>;
  vehicles: any;
};

const snapshotBuffer: Snapshot[] = [];
//const INTERP_DELAY = 100; // ms, typical value 100-200ms
let serverTimeOffsetMs: number = 0;

const stats = new Stats();
// document.body.appendChild(stats.dom);

const clock = new THREE.Clock();

let localId: string | null = null;
let worldIsReady = false;

type NetworkPlayer = {
  id: string;
  position: { x: number; y: number; z: number };
  quaternion: { x: number; y: number; z: number; w: number };
  velocity: { x: number; y: number; z: number };
  color: string;
  health: number;
  coins: number;
  keys: any;
  isSitting: boolean;
  controlledObject: any;
};

let ping = 0;
const networkPlayers = new Map<string, ClientPlayer>();
let lastSentState: any = {};

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x95f2f5);

// Camera

const camera = CameraManager.instance.getCamera();
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
  joystickY = -y;
});

// Networking
const socket = NetworkManager.instance.getSocket();

function catmullRom(
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  p3: THREE.Vector3,
  t: number
) {
  const t2 = t * t;
  const t3 = t2 * t;
  return p0
    .clone()
    .multiplyScalar(-0.5 * t3 + t2 - 0.5 * t)
    .add(p1.clone().multiplyScalar(1.5 * t3 - 2.5 * t2 + 1.0))
    .add(p2.clone().multiplyScalar(-1.5 * t3 + 2.0 * t2 + 0.5 * t))
    .add(p3.clone().multiplyScalar(0.5 * t3 - 0.5 * t2));
}

// ✅ Do not bind listeners immediately — only after init()
function registerSocketEvents(world: World) {
  setInterval(() => {
    const start = Date.now();
    socket.emit("pingCheck", start);
  }, 3000);

  function syncTime() {
    const clientSent = Date.now();
    socket.emit("syncTime", clientSent);
  }

  socket.on("syncTimeResponse", ({ clientSent, serverNow }) => {
    const clientRecv = Date.now();
    const rtt = clientRecv - clientSent;
    const oneWay = rtt / 2;

    // estimated offset = (serverTime when server responded) - (client time when we got it)
    serverTimeOffsetMs = serverNow + oneWay - clientRecv;
    console.log("serverTimeOffsetMs", serverTimeOffsetMs);
  });

  // call it a few times for better estimate
  for (let i = 0; i < 5; i++) {
    setTimeout(syncTime, i * 200);
  }

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

  // socket.on(
  //   "updateData",
  //   (data: { world: any; players: Record<string, NetworkPlayer> }) => {
  //     if (!worldIsReady) return;

  //     for (const [key, value] of Object.entries(data.players)) {
  //       let netPlayer = networkPlayers.get(key);

  //       if (!netPlayer) {
  //         const newPlayer = new ClientPlayer(key, "0xffffff", scene);
  //         networkPlayers.set(key, newPlayer);
  //         netPlayer = newPlayer;
  //       }

  //       netPlayer.setState(value as any);
  //     }

  //     world.updateState(data.world);
  //   }
  // );

  socket.on("updateData", (data) => {
    if (!worldIsReady) return;

    if (!localId) return;

    // --- handle local separately ---
    const localState = data.players[localId];
    if (localState) {
      reconcileLocalPlayer(localState);
      delete data.players[localId];
    }

    snapshotBuffer.push({
      time: data.time,
      players: data.players,
      vehicles: data.world.vehicles,
    });

    if (snapshotBuffer.length > 50) snapshotBuffer.shift();

    world.updateState(data.world);
  });
}

// Keep a small helper map for extrapolation state
const extrapolationState = new Map<
  string,
  { basePos: THREE.Vector3; lastTime: number }
>();

const serverTickMs = 1000 / 30;

// vehicles?.forEach((networkVehicle) => {
//   const clientVehicle = this.getObjById(
//     networkVehicle.id,
//     this.vehicles
//   ) as ClientVehicle;

//   if (!clientVehicle) return;

//   clientVehicle.updateState(
//     networkVehicle.position,
//     networkVehicle.quaternion,
//     networkVehicle.wheels,
//     networkVehicle.hornPlaying
//   );
// });

function reconcileLocalPlayer(
  serverState: NetworkPlayer & { lastProcessedInputSeq?: number }
) {
  if (!localId) return;

  const player = networkPlayers.get(localId);
  if (!player) return;

  // 1. Snap to server’s authoritative state
  player.setPosition(
    new THREE.Vector3(
      serverState.position.x,
      serverState.position.y,
      serverState.position.z
    )
  );
  player.setQuaternion(
    new THREE.Quaternion(
      serverState.quaternion.x,
      serverState.quaternion.y,
      serverState.quaternion.z,
      serverState.quaternion.w
    )
  );
  player.velocity.set(
    serverState.velocity.x,
    serverState.velocity.y,
    serverState.velocity.z
  );
  player.health = serverState.health;
  player.coins = serverState.coins;

  // 2. Drop all confirmed inputs
  if (serverState.lastProcessedInputSeq !== undefined) {
    pendingInputs = pendingInputs.filter(
      (input) => input.seq > serverState.lastProcessedInputSeq!
    );
  }

  // 3. Replay unconfirmed inputs on top of server state
  for (const input of pendingInputs) {
    player.predictMovement(input.dt, input.keys);
  }
}

function interpolateVehicles() {
  const INTERP_DELAY = Math.max(100, serverTickMs * 2 + ping * 0.5);

  if (snapshotBuffer.length < 2) return;

  const renderServerTime = Date.now() + serverTimeOffsetMs - INTERP_DELAY;

  let older: Snapshot | null = null;
  let newer: Snapshot | null = null;

  for (let i = snapshotBuffer.length - 1; i >= 0; i--) {
    if (snapshotBuffer[i].time <= renderServerTime) {
      older = snapshotBuffer[i];
      newer = snapshotBuffer[i + 1] || null;
      break;
    }
  }

  if (!older) return;

  // --- Case 1: Normal interpolation ---
  if (newer) {
    // Clear extrapolation state (we’re back on track)
    extrapolationState.clear();

    const dt = newer.time - older.time;
    const alpha = dt > 0 ? (renderServerTime - older.time) / dt : 0;
    const t = Math.max(0, Math.min(1, alpha));

    for (let i = 0; i < older.vehicles.length; i++) {
      const pOld = older.vehicles[i] as ClientVehicle;
      const pNew = newer.vehicles[i] || pOld;

      // let netPlayer = networkPlayers.get(id);
      // if (!netPlayer) {
      //   netPlayer = new ClientPlayer(id, pOld.color, scene);
      //   networkPlayers.set(id, netPlayer);
      // }

      const clientVehicle = world?.getObjById(pOld.id, world.vehicles);
      if (!clientVehicle) return;

      const posOld = new THREE.Vector3(
        pOld.position.x,
        pOld.position.y,
        pOld.position.z
      );
      const posNew = new THREE.Vector3(
        pNew.position.x,
        pNew.position.y,
        pNew.position.z
      );
      const targetPos = posOld.lerp(posNew, t);

      const quatOld = new THREE.Quaternion(
        pOld.quaternion.x,
        pOld.quaternion.y,
        pOld.quaternion.z,
        pOld.quaternion.w
      );
      const quatNew = new THREE.Quaternion(
        pNew.quaternion.x,
        pNew.quaternion.y,
        pNew.quaternion.z,
        pNew.quaternion.w
      );
      const targetQuat = quatOld.slerp(quatNew, t);

      const oldWheels = pOld.wheels;
      const newWheels = (pNew as ClientVehicle).wheels;

      const targetWheels: any[] = [];

      for (let wheelIndex = 0; wheelIndex < oldWheels.length; wheelIndex++) {
        const oldWheel = oldWheels[wheelIndex];
        const newWheel = newWheels[wheelIndex];

        const oldWheelPos = new THREE.Vector3(
          oldWheel.worldPosition.x,
          oldWheel.worldPosition.y,
          oldWheel.worldPosition.z
        );
        const newWheelPos = new THREE.Vector3(
          newWheel.worldPosition.x,
          newWheel.worldPosition.y,
          newWheel.worldPosition.z
        );

        const targetWheelPos = oldWheelPos.lerp(newWheelPos, t);

        const oldWheelQuat = new THREE.Quaternion(
          oldWheel.quaternion.x,
          oldWheel.quaternion.y,
          oldWheel.quaternion.z,
          oldWheel.quaternion.w
        );
        const newWheelQuat = new THREE.Quaternion(
          newWheel.quaternion.x,
          newWheel.quaternion.y,
          newWheel.quaternion.z,
          newWheel.quaternion.w
        );

        const targetWheelQuat = oldWheelQuat.slerp(newWheelQuat, t);

        targetWheels[wheelIndex] = {
          worldPosition: targetWheelPos,
          quaternion: targetWheelQuat,
        };
      }

      clientVehicle.updateState(
        targetPos,
        targetQuat,
        targetWheels,
        (pNew as ClientVehicle).hornPlaying
      );
    }
  }
}

function interpolatePlayers() {
  const INTERP_DELAY = Math.max(100, serverTickMs * 2 + ping * 0.5);

  if (snapshotBuffer.length < 2) return;

  const renderServerTime = Date.now() + serverTimeOffsetMs - INTERP_DELAY;

  let older: Snapshot | null = null;
  let newer: Snapshot | null = null;

  for (let i = snapshotBuffer.length - 1; i >= 0; i--) {
    if (snapshotBuffer[i].time <= renderServerTime) {
      older = snapshotBuffer[i];
      newer = snapshotBuffer[i + 1] || null;
      break;
    }
  }

  if (!older) return;

  // --- Case 1: Normal interpolation ---
  if (newer) {
    // Clear extrapolation state (we’re back on track)
    extrapolationState.clear();

    const dt = newer.time - older.time;
    const alpha = dt > 0 ? (renderServerTime - older.time) / dt : 0;
    const t = Math.max(0, Math.min(1, alpha));

    for (const id in older.players) {
      const pOld = older.players[id];
      const pNew = newer.players[id] || pOld;

      let netPlayer = networkPlayers.get(id);

      if (netPlayer?.isLocalPlayer) return;

      if (!netPlayer) {
        netPlayer = new ClientPlayer(id, pOld.color, scene);
        networkPlayers.set(id, netPlayer);
      }

      const posOld = new THREE.Vector3(
        pOld.position.x,
        pOld.position.y,
        pOld.position.z
      );
      const posNew = new THREE.Vector3(
        pNew.position.x,
        pNew.position.y,
        pNew.position.z
      );
      const targetPos = posOld.lerp(posNew, t);

      const quatOld = new THREE.Quaternion(
        pOld.quaternion.x,
        pOld.quaternion.y,
        pOld.quaternion.z,
        pOld.quaternion.w
      );
      const quatNew = new THREE.Quaternion(
        pNew.quaternion.x,
        pNew.quaternion.y,
        pNew.quaternion.z,
        pNew.quaternion.w
      );
      const targetQuat = quatOld.slerp(quatNew, t);

      const velOld = new THREE.Vector3(
        pOld.velocity.x,
        pOld.velocity.y,
        pOld.velocity.z
      );
      const velNew = new THREE.Vector3(
        pNew.velocity.x,
        pNew.velocity.y,
        pNew.velocity.z
      );
      const targetVel = velOld.lerp(velNew, t);

      netPlayer.setState({
        position: targetPos,
        quaternion: targetQuat,
        color: pNew.color,
        health: pNew.health,
        coins: pNew.coins,
        velocity: targetVel,
        keys: pNew.keys,
        isSitting: pNew.isSitting,
        controlledObject: pNew.controlledObject,
      });
    }
  }

  // --- Case 2: Extrapolation ---
  else {
    const delta = clock.getDelta(); // per-frame delta

    for (const id in older.players) {
      const p = older.players[id];

      let netPlayer = networkPlayers.get(id);
      if (!netPlayer) {
        netPlayer = new ClientPlayer(id, p.color, scene);
        networkPlayers.set(id, netPlayer);
      }

      // Get or create extrapolation state
      let state = extrapolationState.get(id);
      if (!state) {
        state = {
          basePos: new THREE.Vector3(p.position.x, p.position.y, p.position.z),
          lastTime: Date.now(),
        };
        extrapolationState.set(id, state);
      }

      // Advance forward smoothly
      const vel = new THREE.Vector3(p.velocity.x, p.velocity.y, p.velocity.z);
      const advance = vel.clone().multiplyScalar(delta);

      state.basePos.add(advance);

      // Cap drift at ~250ms
      if (Date.now() - older.time > 250) return;

      // Blend visible player toward prediction
      netPlayer.getPosition().lerp(state.basePos, 0.8);

      const quat = new THREE.Quaternion(
        p.quaternion.x,
        p.quaternion.y,
        p.quaternion.z,
        p.quaternion.w
      );
      netPlayer.getQuaternion().slerp(quat, 0.2);

      netPlayer.velocity.copy(vel);
    }
  }
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

  camera.position.copy(desiredPosition);
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

let inputSeq = 0;
let pendingInputs: any[] = [];

function animate(world: World) {
  stats.begin();
  const delta = clock.getDelta();

  if (!localId) return;
  const playerObject = networkPlayers.get(localId);
  if (!playerObject) return;

  const payload = {
    seq: inputSeq++,
    dt: 1 / 30,
    keys: inputManager.getState(),
    quaternion: camera.quaternion.clone(),
  };
  pendingInputs.push(payload);

  if (JSON.stringify(payload) !== JSON.stringify(lastSentState)) {
    socket.emit("playerInput", payload);
    lastSentState = payload;
  }

  world.update(delta);
  updateCameraFollow();

  interpolatePlayers();
  interpolateVehicles();

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

  world = new World(scene);
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
