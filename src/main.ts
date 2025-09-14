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
import ClientNPC from "./ClientNPC";
import ClientPhysics from "./ClientPhysics";
import DebugState from "./state/DebugState";

let world: World | null = null;

type Snapshot = {
  time: number; // server time of snapshot (ms)
  players: Record<string, NetworkPlayer>;
  vehicles: any;
  npcs: any;
};

const snapshotBuffer: Snapshot[] = [];
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
  lastProcessedInputSeq?: number;
};

let ping = 0;
const networkPlayers = new Map<string, ClientPlayer>();

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
    serverTimeOffsetMs = serverNow + oneWay - clientRecv;
  });

  for (let i = 0; i < 5; i++) setTimeout(syncTime, i * 200);

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
    const newPlayer = new ClientPlayer(world, playerId, "0xffffff", scene);
    networkPlayers.set(playerId, newPlayer);
  });

  socket.on("removePlayer", (playerId: string) => {
    const player = networkPlayers.get(playerId);
    if (!player) return;
    player.remove();
    networkPlayers.delete(playerId);
  });

  socket.on("updateData", (data) => {
    if (!worldIsReady || !localId) return;

    // handle local separately
    const localState = data.players[localId];
    if (localState) {
      if (DebugState.instance.reconciliation) {
        reconcileLocalPlayer(localState);
      }

      delete data.players[localId];
    }

    snapshotBuffer.push({
      time: data.time,
      players: data.players,
      vehicles: data.world.vehicles,
      npcs: data.world.npcs,
    });

    if (snapshotBuffer.length > 50) snapshotBuffer.shift();
    world.updateState(data.world);
  });
}

// ---------------- Reconciliation ----------------
let inputSeq = 0;
let pendingInputs: any[] = [];

const ghostMesh = new THREE.Mesh(
  new THREE.BoxGeometry(1, 2, 1),
  new THREE.MeshStandardMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.5,
  })
);

function getVelocityFromInput(
  keys: any,
  camQuat: THREE.Quaternion,
  speedWalk = 4,
  speedRun = 8
): THREE.Vector3 {
  const inputDir = new THREE.Vector3();

  // WASD → input direction
  if (keys.w) inputDir.z -= 1;
  if (keys.s) inputDir.z += 1;
  if (keys.a) inputDir.x -= 1;
  if (keys.d) inputDir.x += 1;

  // If no input, return zero vector
  if (inputDir.lengthSq() === 0) return new THREE.Vector3(0, 0, 0);

  // Normalize input so diagonal speed isn't faster
  inputDir.normalize();

  // Camera yaw only (ignore pitch)
  const euler = new THREE.Euler().setFromQuaternion(camQuat, "YXZ");
  const yawQuat = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    euler.y
  );

  // Convert to world direction
  const worldDir = inputDir.applyQuaternion(yawQuat);

  // Speed based on shift
  const speed = keys.shift ? speedRun : speedWalk;

  // Final velocity (horizontal only)
  return worldDir.multiplyScalar(speed);
}

function reconcileLocalPlayer(serverState: NetworkPlayer) {
  if (!localId) return;
  const player = networkPlayers.get(localId);
  if (!player) return;

  // Store correction for main loop
  player.serverPos = new THREE.Vector3(
    serverState.position.x,
    serverState.position.y,
    serverState.position.z
  );
  player.serverVel = new THREE.Vector3(
    serverState.velocity.x,
    serverState.velocity.y,
    serverState.velocity.z
  );

  // Keep only inputs not yet processed
  if (serverState.lastProcessedInputSeq !== undefined) {
    pendingInputs = pendingInputs.filter(
      (input) => input.seq > serverState.lastProcessedInputSeq!
    );
  }
}

// ---------------- Interpolation ----------------
const extrapolationState = new Map<
  string,
  { basePos: THREE.Vector3; lastTime: number }
>();
const serverTickMs = 1000 / 30;

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

  if (newer) {
    extrapolationState.clear();
    const dt = newer.time - older.time;
    const alpha = dt > 0 ? (renderServerTime - older.time) / dt : 0;
    const t = Math.max(0, Math.min(1, alpha));

    for (const id in older.players) {
      const pOld = older.players[id];
      const pNew = newer.players[id] || pOld;

      let netPlayer = networkPlayers.get(id);
      if (id === localId) continue; // skip local, reconciliation handles it

      // if (!netPlayer) {
      //   netPlayer = new ClientPlayer(world, id, pOld.color, scene);
      //   networkPlayers.set(id, netPlayer);
      // }

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

      netPlayer?.setState({
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

  if (newer) {
    extrapolationState.clear();
    const dt = newer.time - older.time;
    const alpha = dt > 0 ? (renderServerTime - older.time) / dt : 0;
    const t = Math.max(0, Math.min(1, alpha));

    for (let i = 0; i < older.vehicles.length; i++) {
      const pOld = older.vehicles[i] as ClientVehicle;
      const pNew = newer.vehicles[i] || pOld;

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

function interpolateNPCs() {
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

  if (newer) {
    extrapolationState.clear();
    const dt = newer.time - older.time;
    const alpha = dt > 0 ? (renderServerTime - older.time) / dt : 0;
    const t = Math.max(0, Math.min(1, alpha));

    for (let i = 0; i < older.npcs.length; i++) {
      const pOld = older.npcs[i] as any;
      const pNew = newer.npcs[i] || pOld;

      const clientNPC = world?.getObjById(pOld.networkId, world.npcs);
      if (!clientNPC) return;

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

      const targetVel = new THREE.Vector3(
        pOld.velocity.x,
        pOld.velocity.y,
        pOld.velocity.z
      ).lerp(
        new THREE.Vector3(pNew.velocity.x, pNew.velocity.y, pNew.velocity.z),
        t
      );
      clientNPC.setState({
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
}

// ---------------- Camera ----------------
const smoothCameraPos = new THREE.Vector3();
const smoothLookAt = new THREE.Vector3();

function updateCameraFollow() {
  if (!localId) return;
  const player = networkPlayers.get(localId);
  if (!player) return;

  const playerPos = player.getPosition();
  const distance = InputManager.instance.cameraDistance;
  const height = 1;

  // Mobile joystick rotation
  if (isMobile()) {
    InputManager.instance.cameraYaw -= joystickX * mobileSens;
    InputManager.instance.cameraPitch -= joystickY * mobileSens;
  }

  // Clamp pitch
  const maxPitch = Math.PI / 3;
  const minPitch = -Math.PI / 12;
  InputManager.instance.cameraPitch = Math.max(
    minPitch,
    Math.min(maxPitch, InputManager.instance.cameraPitch)
  );

  // Desired camera offset
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

  const desiredCameraPos = new THREE.Vector3(
    playerPos.x + offsetX,
    playerPos.y + offsetY,
    playerPos.z + offsetZ
  );

  // Smooth camera position
  smoothCameraPos.lerp(desiredCameraPos, 1);

  // Smooth look-at target (reduces world jitter)
  const desiredLookAt = new THREE.Vector3(
    playerPos.x,
    playerPos.y + height,
    playerPos.z
  );
  smoothLookAt.lerp(desiredLookAt, 1);

  // Apply
  camera.position.copy(smoothCameraPos);
  camera.lookAt(smoothLookAt);
}

// ---------------- Interactables ----------------
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

// ---------------- UI ----------------
function updateUI(player: ClientPlayer, wantsToInteract: boolean) {
  const eventData = {
    networkId: localId,
    position: player.getPosition(),
    health: player.health,
    coins: player.coins,
    playerCount: networkPlayers.size,
    ping: ping,
  };
  window.dispatchEvent(new CustomEvent("player-update", { detail: eventData }));
  window.dispatchEvent(
    new CustomEvent("ui-update", { detail: { wantsToInteract } })
  );
}

const FIXED_DT = 1 / 60;
let accumulator = 0;

function animate(world: World) {
  stats.begin();
  const delta = clock.getDelta();

  if (!localId) return;
  const playerObject = networkPlayers.get(localId);
  if (!playerObject) return;

  accumulator += delta;
  while (accumulator >= FIXED_DT) {
    const keys = InputManager.instance.getState();
    const input = {
      seq: inputSeq++,
      dt: FIXED_DT,
      keys,
      camQuat: camera.quaternion.clone(),
    };
    pendingInputs.push(input);
    socket.emit("playerInput", input);

    // --- Apply server correction once per tick ---
    if (playerObject.serverPos) {
      const rb = playerObject["physicsObject"].rigidBody;
      const currentPos = new THREE.Vector3().copy(rb.translation());
      const error = currentPos.distanceTo(playerObject.serverPos);

      if (error > 1.0) {
        // Big error → snap
        rb.setTranslation(playerObject.serverPos, true);
        rb.setLinvel(playerObject.serverVel!, true);
      } else if (error > 0.05) {
        // Small error → smooth correction
        const alpha = 0.1; // 10% toward corrected each frame
        const lerpPos = currentPos.lerp(playerObject.serverPos, alpha);
        const lerpVel = new THREE.Vector3()
          .copy(rb.linvel())
          .lerp(playerObject.serverVel!, alpha);
        rb.setTranslation(lerpPos, true);
        rb.setLinvel(lerpVel, true);
      }

      // Clear after applying
      playerObject.serverPos = null;
      playerObject.serverVel = null;
    }

    // --- Run local prediction as usual ---
    playerObject.predictMovement(FIXED_DT, keys, input.camQuat);
    accumulator -= FIXED_DT;
  }

  // --- Normal per-frame updates ---
  world.update(delta);
  updateCameraFollow();
  interpolatePlayers();
  interpolateVehicles();
  interpolateNPCs();

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

// ---------------- Init ----------------
async function init() {
  const assetsManager = AssetsManager.instance;
  await assetsManager.loadAll();

  world = new World(scene);
  await world.init();

  if (!socket.id) {
    console.log("no socket id i.e. no connection");
    return;
  }

  localId = socket.id;
  const player = new ClientPlayer(world, localId, "0xffffff", scene, true);
  networkPlayers.set(localId, player);

  registerSocketEvents(world);
  animate(world);

  window.dispatchEvent(
    new CustomEvent("loading-status", { detail: { ready: true } })
  );
  setTimeout(() => {
    worldIsReady = true;
    socket.emit("readyForWorld");
  }, 2000);
}

function resizeRenderer() {
  // update renderer canvas size
  renderer.setSize(window.innerWidth, window.innerHeight);

  // update camera aspect ratio
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resizeRenderer);

socket.on("connect", () => {
  console.log("Connected with server with id:", socket.id);
  init();
});

socket.on("connect_error", (err: any) => {
  console.error("Socket connection error:", err);
  window.dispatchEvent(
    new CustomEvent("loading-status", {
      detail: {
        error: {
          title: "Connection error",
          info: "The server appears to be unreachable, please try again later",
        },
      },
    })
  );
});
