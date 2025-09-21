import * as THREE from "three";
import World from "./World";
import InputManager from "./InputManager";
import ClientPlayer from "./ClientPlayer";
import { AssetsManager } from "./AssetsManager";
import { createToast, getRandomFromArray, isMobile } from "./utils";
import AudioManager from "./AudioManager";

import Stats from "stats.js";
import NetworkManager from "./NetworkManager";
import ChatManager from "./ChatManager";
import ClientVehicle from "./ClientVehicle";
import CameraManager from "./CameraManager";
import DebugState from "./state/DebugState";
import ClientWeapon from "./ClientWeapon";
import { randFloat } from "three/src/math/MathUtils";

let world: World | null = null;

export type ServerNotification = {
  type: "error" | "success" | "info";
  content: string;
  duration?: number;
};

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
  nickname: string;
  leftHand: any;
  rightHand: any;
  viewQuaternion: { x: number; y: number; z: number; w: number };
};

let ping = 0;

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
    const { players } = data;

    if (players) {
      for (const [id, value] of Object.entries(players)) {
        const player = world.getPlayerById(id);

        if (player) continue;

        const newPlayer = new ClientPlayer(world, id, "0xffffff", scene);
        world.addPlayer(newPlayer);
      }
    }

    world.initWorldData(data);
  });

  socket.on("init-chat", (data: any) => {
    ChatManager.instance.init(data && data.messages ? data.messages : []);
  });

  socket.on("server-notification", (data: ServerNotification) => {
    createToast(data);
  });

  socket.on("zoneCreated", (data: any) => {
    world.createZone(data);
  });

  socket.on("addVehicle", (data: any) => {
    world.addVehicle(data);
  });

  socket.on("addNPC", (data: any) => {
    world.addNPC(data);
  });

  socket.on("interactableCreated", (data: any) => {
    world.createInteractable(data);
  });

  socket.on("zoneRemoved", (uuid: string) => {
    world.removeByUUID(uuid);
  });

  type InteractableRemovedData = {
    id: string;
    meta: {
      type: string;
      item: string;
      amount: number;
      usedBy: string;
    };
  };

  socket.on("interactableRemoved", (data: InteractableRemovedData) => {
    // only play this if picker is local player
    if (data.meta.usedBy == NetworkManager.instance.localId) {
      createToast({
        type: "success",
        content: `+${data.meta.amount} ${data.meta.item}`,
        duration: 1000,
      });

      AudioManager.instance.playAudio("pickup", 0.1);
    }

    world.removeInteractableByUUID(data.id);
  });

  socket.on("vehicleRemoved", (uuid: string) => {
    world.removeVehicleByUUID(uuid);
  });

  socket.on("npcRemoved", (uuid: string) => {
    world.removeNPCByUUID(uuid);
  });

  socket.on(
    "user_action",
    (data: { id: string; type: string; hasHit: boolean }) => {
      if (data.type == "attack") {
        const player = world.getPlayerById(data.id);
        if (!player) return;

        const animList = ["MeleeMotion", "MeleeMotion_2"];
        player.playAnimation(getRandomFromArray(animList));

        if (data.hasHit) {
          AudioManager.instance.playAudio("punch_impact", 0.5);
        }
      }
    }
  );

  socket.on(
    "register-hit",
    (data: {
      position: { x: number; y: number; z: number };
      hitPlayer: string | null;
      hitBodyPart: "head" | "torso" | "legs" | null;
    }) => {
      const randomAudioList = ["impact_1", "impact_2", "impact_3", "impact_3"];

      if (data.hitPlayer) {
        const bp = data.hitBodyPart;

        if (bp == "head") {
          AudioManager.instance.playAudio(
            "impact_headshot",
            0.1,
            randFloat(1, 1000)
          );
          return;
        }

        AudioManager.instance.playAudio("hitmarker", 0.2);
        return;
      }

      world.createHitmarker(
        new THREE.Vector3(data.position.x, data.position.y, data.position.z)
      );
    }
  );

  socket.on(
    "create-hitmarker",
    (data: { position: { x: number; y: number; z: number } }) => {
      world.createHitmarker(
        new THREE.Vector3(data.position.x, data.position.y, data.position.z)
      );

      // const randomAudioList = ["impact_1", "impact_2"];
      // AudioManager.instance.playAudio(
      //   getRandomFromArray(randomAudioList),
      //   0.0
      // );
    }
  );

  socket.on("addPlayer", (playerId: string) => {
    const newPlayer = new ClientPlayer(world, playerId, "0xffffff", scene);
    world.addPlayer(newPlayer);
  });

  socket.on("removePlayer", (playerId: string) => {
    world.removePlayer(playerId);
  });

  socket.on("updateData", (data) => {
    if (!worldIsReady || !NetworkManager.instance.localId) return;

    // fake ping

    // handle local separately
    const serverState = data.players[
      NetworkManager.instance.localId
    ] as ClientPlayer;
    if (serverState) {
      if (DebugState.instance.reconciliation) {
        reconcileLocalPlayer(serverState as any);
      }

      delete data.players[NetworkManager.instance.localId];
    }

    if (serverState.controlledObject) {
      const serverVehicle = data.world.vehicles?.find(
        (veh: any) => veh.id == serverState.controlledObject!.id
      );

      if (serverVehicle) {
        reconcileLocalVehicle(serverVehicle);
      }
    }

    // data.vehicles?.forEach((networkVehicle: any) => {
    //   const clientVehicle = world.getObjById(
    //     networkVehicle.id,
    //     world.vehicles
    //   ) as ClientVehicle;

    //   if (!clientVehicle) return;

    // });

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
let vehicleInputSeq = 0;
let pendingInputs: any[] = [];
let pendingVehicleInputs: any[] = [];

const ghostMesh = new THREE.Mesh(
  new THREE.BoxGeometry(1, 2, 1),
  new THREE.MeshStandardMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.5,
  })
);

scene.add(ghostMesh);

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
  if (!NetworkManager.instance.localId) return;
  const player = world?.getPlayerById(NetworkManager.instance.localId);
  if (!player) return;

  if (player.controlledObject) return;

  player.setState(serverState as any);

  // Server snapshot position & velocity
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

  player.lastServerTime = Date.now();

  // Filter inputs we haven't processed yet
  if (serverState.lastProcessedInputSeq !== undefined) {
    pendingInputs = pendingInputs.filter(
      (input) => input.seq > serverState.lastProcessedInputSeq!
    );
  }
}

type ServerVehicle = {
  id: string;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  seats: any[];
  wheels: any[];
  hornPlaying: boolean;
  linearVelocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  lastProcessedInputSeq: number;
};

function reconcileLocalVehicle(serverVehicle: ServerVehicle) {
  const localVehicle = world?.getObjById(serverVehicle.id, world.vehicles);

  if (!localVehicle) return;

  localVehicle.serverPos = new THREE.Vector3(
    serverVehicle.position.x,
    serverVehicle.position.y,
    serverVehicle.position.z
  );

  localVehicle.serverQuaternion = new THREE.Quaternion(
    serverVehicle.quaternion.x,
    serverVehicle.quaternion.y,
    serverVehicle.quaternion.z,
    serverVehicle.quaternion.w
  );

  localVehicle.serverLinearVelocity = new THREE.Vector3(
    serverVehicle.linearVelocity.x,
    serverVehicle.linearVelocity.y,
    serverVehicle.linearVelocity.z
  );

  localVehicle.serverAngularVelocity = new THREE.Vector3(
    serverVehicle.angularVelocity.x,
    serverVehicle.angularVelocity.y,
    serverVehicle.angularVelocity.z
  );

  if (serverVehicle.lastProcessedInputSeq !== undefined) {
    pendingVehicleInputs = pendingVehicleInputs.filter(
      (input) => input.seq > serverVehicle.lastProcessedInputSeq
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

      let netPlayer = world?.getPlayerById(id);
      if (id === NetworkManager.instance.localId) continue; // skip local, reconciliation handles it

      // if (!netPlayer) {
      //   netPlayer = new ClientPlayer(world!, id, pOld.color, scene);
      //   networkPlayers.set(id, netPlayer);

      //   console.log("Creating player");
      // }

      if (!netPlayer) continue;

      // skip if share same vehicle
      const localPlayer = world?.getPlayerById(
        NetworkManager.instance.localId!
      );
      const localVehicleId = localPlayer?.controlledObject?.id;
      const remoteVehicleId = netPlayer.controlledObject?.id;

      if (
        localVehicleId &&
        remoteVehicleId &&
        localVehicleId === remoteVehicleId
      ) {
        // They share the same local vehicle → seat updates handle them

        //console.log("yes");
        netPlayer.controlledObject = pNew.controlledObject; // this ensures controlledObject updates
        netPlayer.isSitting = pNew.isSitting;
        netPlayer.color = pNew.color;
        netPlayer.coins = pNew.coins;
        netPlayer.keys = pNew.keys;
        netPlayer.nickname = pNew.nickname;

        // netPlayer.leftHand = pNew.leftHand;
        // netPlayer.leftHand = pNew.leftHand;

        continue;
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

      netPlayer?.setRemoteState({
        position: targetPos,
        quaternion: targetQuat,
        color: pNew.color,
        health: pNew.health,
        coins: pNew.coins,
        velocity: targetVel,
        keys: pNew.keys,
        isSitting: pNew.isSitting,
        controlledObject: pNew.controlledObject,
        nickname: pNew.nickname,
        leftHand: pNew.leftHand,
        rightHand: pNew.rightHand,
        camQuat: new THREE.Quaternion(
          pNew.viewQuaternion.x,
          pNew.viewQuaternion.y,
          pNew.viewQuaternion.z,
          pNew.viewQuaternion.w
        ),
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
      const pOld = older.vehicles[i] as any;
      const pNew = newer.vehicles[i] || pOld;

      const clientVehicle = world?.getObjById(
        pOld.id,
        world.vehicles
      ) as ClientVehicle;
      if (!clientVehicle) return;

      //dont interpolate vehicle occupied by local player
      if (
        clientVehicle.getDriver() &&
        clientVehicle.getDriver()?.networkId == NetworkManager.instance.localId
      )
        continue;

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
      const newWheels = (pNew as any).wheels;
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

      clientVehicle.updateRemoteState(
        targetPos,
        targetQuat,
        targetWheels,
        (pNew as ClientVehicle).hornPlaying,
        (pNew as ClientVehicle).seats
      );

      for (
        let seatIndex = 0;
        seatIndex < clientVehicle.seats.length;
        seatIndex++
      ) {
        const seat = clientVehicle.seats[seatIndex];
        if (seat.seater) {
          updatePlayerSeatTransform(seat.seater, clientVehicle, seatIndex);
        }
      }
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

      const clientNPC = world?.getObjById(pOld.id, world.npcs);
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

let recoilOffsetPitch = 0;
let recoilOffsetYaw = 0;

// function applyRecoil(delta: number) {
//   // move camera instantly by current recoil
//   InputManager.instance.cameraPitch -= recoilOffsetPitch * delta * 20;
//   InputManager.instance.cameraYaw += recoilOffsetYaw * delta * 20;

//   // decay recoil fast back to zero
//   const decay = 85.0; // bigger = faster return
//   recoilOffsetPitch = THREE.MathUtils.lerp(recoilOffsetPitch, 0, decay * delta);
//   recoilOffsetYaw = THREE.MathUtils.lerp(recoilOffsetYaw, 0, decay * delta);
// }

let recoilTarget = 0;
let recoilTime = 0;

function shootRecoil(kick = 2.5) {
  recoilTarget += kick; // every shot adds more vertical recoil
  recoilTime = 0; // reset phase time
}

// --- RECOIL STATE (ADD THIS) ---
const recoil = {
  base: 0, // small persistent climb (radians)
  kick: 0, // transient upward push (radians)
  yawKick: 0, // transient yaw sway (radians)
  appliedPitch: 0, // how much we've applied to camera so far
  appliedYaw: 0,
  lastSeenShotTime: 0, // last time we saw a local shot (ms)
};

// cheap exponential damper using "half-life" (how long to halve the error)
function expDamp(
  current: number,
  target: number,
  halfLife: number,
  dt: number
) {
  const k = Math.pow(0.5, dt / Math.max(halfLife, 1e-5));
  return target + (current - target) * k;
}

// call this once per *actual* shot
function triggerShotRecoil() {
  const kickUp = THREE.MathUtils.degToRad(2);
  const residual = kickUp * 0.1; // how much stays after each shot
  const yawMax = THREE.MathUtils.degToRad(1);

  recoil.kick += kickUp;
  recoil.base += residual; // baseline goes UP and stays there
  recoil.yawKick += (Math.random() * 2 - 1) * yawMax;
}

function updateRecoil(delta: number, isAiming: boolean) {
  // fast decay of transient kick
  recoil.kick = expDamp(recoil.kick, 0, 0.08, delta);
  recoil.yawKick = expDamp(recoil.yawKick, 0, 0.08, delta);

  // total offset = baseline + transient
  const wantPitch = recoil.base + recoil.kick;
  const wantYaw = recoil.yawKick;

  const dPitch = wantPitch - recoil.appliedPitch;
  const dYaw = wantYaw - recoil.appliedYaw;

  InputManager.instance.cameraPitch -= dPitch;
  InputManager.instance.cameraYaw += dYaw;

  recoil.appliedPitch = wantPitch;
  recoil.appliedYaw = wantYaw;
}
let aimBlend = 0; // put this at the top with globals

function getAimDistance(player: ClientPlayer): number {
  if (player.rightHand.item) return 2;

  return 3;
}

function updateCameraFollow(delta: number) {
  if (!NetworkManager.instance.localId) return;
  const player = world?.getPlayerById(NetworkManager.instance.localId);
  if (!player) return;

  const keys = InputManager.instance.getState();
  const aiming = keys.mouseRight;
  const playerPos = player.getPosition();
  const rightHandItem = player.rightHand?.item as ClientWeapon;

  // --- Smooth aiming transition only ---
  const aimTarget = aiming ? 1 : 0;
  aimBlend = THREE.MathUtils.lerp(
    aimBlend,
    aimTarget,
    1 - Math.exp(-delta * 20) // higher = faster blend
  );

  // --- Mobile joystick input (instant) ---
  if (isMobile()) {
    InputManager.instance.cameraYaw -= joystickX * mobileSens;
    InputManager.instance.cameraPitch -= joystickY * mobileSens;
  }

  // --- Camera rotation ---
  const yawQuat = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    InputManager.instance.cameraYaw
  );
  const pitchQuat = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    -InputManager.instance.cameraPitch
  );
  const camRot = yawQuat.clone().multiply(pitchQuat);

  // --- Distance + side offset with aim blend ---
  const baseDistance = InputManager.instance.cameraDistance;
  const aimDistance = getAimDistance(player);
  const distance = THREE.MathUtils.lerp(baseDistance, aimDistance, aimBlend);

  const sideOffsetAmount = rightHandItem
    ? THREE.MathUtils.lerp(0, 0.5, aimBlend)
    : 0;
  const sideOffset = new THREE.Vector3(sideOffsetAmount, 0, 0).applyQuaternion(
    yawQuat
  );

  // --- Desired camera pos ---
  const height = 0.75;
  const backOffset = new THREE.Vector3(0, 0, distance).applyQuaternion(camRot);
  const desiredCameraPos = playerPos
    .clone()
    .add(new THREE.Vector3(0, height, 0))
    .add(sideOffset)
    .add(backOffset);
  const lookAtPoint = playerPos
    .clone()
    .add(new THREE.Vector3(0, height, 0))
    .add(sideOffset);

  updateRecoil(delta, aiming);

  // --- Apply instantly (no smoothing) ---
  camera.position.copy(desiredCameraPos);
  camera.lookAt(lookAtPoint);
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
  const showCrosshair =
    player.rightHand.item != null &&
    InputManager.instance.getState().mouseRight;

  const eventData = {
    networkId: NetworkManager.instance.localId,
    position: player.getPosition(),
    health: player.health,
    coins: player.coins,
    playerCount: world?.players.size,
    ping: ping,
    showCrosshair: showCrosshair,
    weapon: player.rightHand.item,
  };
  window.dispatchEvent(new CustomEvent("player-update", { detail: eventData }));
  window.dispatchEvent(
    new CustomEvent("ui-update", { detail: { wantsToInteract } })
  );
}

const FIXED_DT = 1 / 60;
let accumulator = 0;

const latency = ((ping > 0 ? ping : 1) * 0.5) / 1000; // seconds

function updateLocalCharacterPrediction(player: ClientPlayer, delta: number) {
  const playerObject = player;

  accumulator += delta;

  while (accumulator >= FIXED_DT) {
    // --- 1) Collect input & predict instantly ---
    const keys = InputManager.instance.getState();
    const input = {
      type: "character",
      seq: inputSeq++,
      dt: FIXED_DT,
      keys,
      camQuat: camera.quaternion.clone(),
      camPos: camera.position.clone(),
    };
    pendingInputs.push(input);
    socket.emit("playerInput", input);

    // Predict immediately for responsiveness
    playerObject.predictMovement(FIXED_DT, keys, input.camQuat);
    accumulator -= FIXED_DT;

    // --- 2) Reconciliation ---
    if (playerObject.serverPos) {
      const rb = playerObject["physicsObject"].rigidBody;
      const currentPos = new THREE.Vector3().copy(rb.translation());

      // How old is the snapshot?
      const now = Date.now();
      const snapshotAge =
        (now + serverTimeOffsetMs - playerObject.lastServerTime) / 1000;

      // Client position at the snapshot time (rewind using local velocity)
      const vel = rb.linvel();
      const localVelocity = new THREE.Vector3(vel.x, vel.y, vel.z);
      const clientAtSnapshot = currentPos
        .clone()
        .sub(localVelocity.clone().multiplyScalar(snapshotAge));

      // Error at the *same point in time*
      const errorVec = playerObject.serverPos.clone().sub(clientAtSnapshot);
      const error = errorVec.length();

      // Show ghost for debugging
      if (DebugState.instance.showGhost) {
        ghostMesh.position.copy(playerObject.serverPos);
      }

      // -------------------------------
      // Adaptive correction parameters
      // -------------------------------

      // Dead-zone grows with ping so small latency errors are ignored
      const deadZone = 0.05 + ping * 0.002; // 0.05 at 0ms → 0.45 at 200ms

      // Correction factor shrinks with ping so movement feels smooth
      const baseFactor = 0.1; // fast correction at low ping
      const factor = Math.max(0.02, baseFactor * (50 / Math.max(ping, 50)));

      // Max correction distance per frame
      const maxCorrection = 0.5; // meters per frame max

      // Are we moving? If so, correct more gently
      const isMoving = localVelocity.length() > 0.1;
      const moveFactor = isMoving ? factor * 0.5 : factor; // Half speed while moving

      // -------------------------------
      // Apply correction
      // -------------------------------

      if (error > 5.0) {
        // Big error → snap
        rb.setTranslation(playerObject.serverPos, true);
        rb.setLinvel(playerObject.serverVel!, true);
      } else if (error > deadZone) {
        // Smooth correction with limits
        const frameCorrection = errorVec.clone().multiplyScalar(moveFactor);

        // Cap correction distance to avoid huge jumps
        if (frameCorrection.length() > maxCorrection) {
          frameCorrection.setLength(maxCorrection);
        }

        rb.setTranslation(currentPos.clone().add(frameCorrection), true);
      }

      // Replay unprocessed inputs after correction
      for (const pending of pendingInputs) {
        playerObject.predictMovement(pending.dt, pending.keys, pending.camQuat);
      }

      // Clear snapshot
      playerObject.serverPos = null;
      playerObject.serverVel = null;
    }
  }
}

function updateLocalVehiclePrediction(vehicle: ClientVehicle, delta: number) {
  accumulator += delta;

  while (accumulator >= FIXED_DT) {
    // --- 1) Collect input & predict instantly ---
    const keys = InputManager.instance.getState();
    const input = {
      type: "vehicle",
      seq: vehicleInputSeq++,
      keys: keys,
      dt: FIXED_DT,
    };
    pendingVehicleInputs.push(input);
    socket.emit("vehicleInput", input);

    // Predict immediately for responsiveness
    vehicle.predictMovementCustom(keys);
    accumulator -= FIXED_DT;

    // --- 2) Reconciliation (server authority) ---
    if (vehicle.serverPos) {
      const rb = vehicle["physicsObject"]?.rigidBody;

      if (!rb) return;

      const currentPos = new THREE.Vector3().copy(rb.translation());

      // Age of the snapshot
      const now = Date.now();
      const snapshotAge =
        (now + serverTimeOffsetMs - (vehicle.lastServerTime || now)) / 1000;

      // Vehicle position at the snapshot time (rewind using local velocity)
      const linVel = rb.linvel();
      const localVelocity = new THREE.Vector3(linVel.x, linVel.y, linVel.z);
      const clientAtSnapshot = currentPos
        .clone()
        .sub(localVelocity.clone().multiplyScalar(snapshotAge));

      // Error vector between client & server positions at the same point in time
      const errorVec = vehicle.serverPos.clone().sub(clientAtSnapshot);
      const error = errorVec.length();

      // Debug ghost
      if (DebugState.instance.showGhost) {
        ghostMesh.position.copy(vehicle.serverPos);
        ghostMesh.quaternion.copy(vehicle.serverQuaternion!);
      }

      // -------------------------------
      // Adaptive correction parameters
      // -------------------------------

      // Dead-zone grows with ping → ignore small errors
      const deadZone = 0.1 + ping * 0.002; // 0.1 at 0ms → 0.5 at 200ms

      // Correction factor shrinks with ping → smoother motion on high latency
      const baseFactor = 0.1;
      const factor = Math.max(0.02, baseFactor * (50 / Math.max(ping, 50)));

      // Maximum correction distance per frame
      const maxCorrection = 1.0; // meters per frame

      // Correct less aggressively while moving
      const isMoving = localVelocity.length() > 0.5;
      const moveFactor = isMoving ? factor * 0.5 : factor;

      // -------------------------------
      // Apply correction
      // -------------------------------

      if (error > 8.0) {
        // Very big error → hard snap
        rb.setTranslation(vehicle.serverPos, true);
        rb.setLinvel(vehicle.serverLinearVelocity!, true);
        rb.setAngvel(vehicle.serverAngularVelocity!, true);
        rb.setRotation(vehicle.serverQuaternion!, true);
      } else if (error > deadZone) {
        // Smooth correction with limits
        const frameCorrection = errorVec.clone().multiplyScalar(moveFactor);

        // Cap correction distance
        if (frameCorrection.length() > maxCorrection) {
          frameCorrection.setLength(maxCorrection);
        }

        rb.setTranslation(currentPos.clone().add(frameCorrection), true);

        // Smoothly correct rotation too
        const currentRot = rb.rotation();
        const serverRot = vehicle.serverQuaternion!;
        const quatCurrent = new THREE.Quaternion(
          currentRot.x,
          currentRot.y,
          currentRot.z,
          currentRot.w
        );
        const quatServer = serverRot.clone();
        quatCurrent.slerp(quatServer, moveFactor);
        rb.setRotation(quatCurrent, true);

        // Also update velocities
        rb.setLinvel(vehicle.serverLinearVelocity!, true);
        rb.setAngvel(vehicle.serverAngularVelocity!, true);
      }

      // Replay unprocessed inputs since the last processed one
      for (const pending of pendingVehicleInputs) {
        vehicle.predictMovementCustom(pending.keys);
      }

      // Clear server snapshot after applying
      vehicle.serverPos = null;
      vehicle.serverQuaternion = null;
      vehicle.serverLinearVelocity = null;
      vehicle.serverAngularVelocity = null;
    }
  }
}

function updatePlayerSeatTransform(
  player: ClientPlayer,
  vehicle: ClientVehicle,
  seatIndex: number
) {
  const seat = vehicle.seats[seatIndex];
  if (!seat) return;

  // Position
  const globalPos = vehicle.mesh.position
    .clone()
    .add(
      new THREE.Vector3(seat.position.x, seat.position.y, seat.position.z)
        .clone()
        .applyQuaternion(vehicle.mesh.quaternion)
    );

  player.setPosition(globalPos);

  // Rotation with 180° Y-axis flip
  const extraRot = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    Math.PI
  );
  const finalQuat = vehicle.mesh.quaternion.clone().multiply(extraRot);

  player.setQuaternion(finalQuat);
}

// put these at the top of your file with other globals
let prevFire = false;
let recoilPitchOffset = 0;
let recoilYawOffset = 0;

function updateLocalPlayer(player: ClientPlayer, delta: number) {
  const keys = InputManager.instance.getState();
  const aiming = keys.mouseRight;
  const shooting = keys.mouseLeft && aiming;
  const shotPressed = shooting && !prevFire; // rising edge → one shot only

  const rightHandItem = player.rightHand.item as ClientWeapon;

  if (shotPressed && rightHandItem) {
    const fired = rightHandItem.use();
    if (fired) {
      player.lastUseHandTime = Date.now();
      triggerShotRecoil(); // only called when a real shot fired
    }
  }

  prevFire = shooting; // store fire state for next frame

  // --- Normal player movement prediction ---
  if (player.controlledObject) {
    const localVehicle = world?.getObjById(
      player.controlledObject.id,
      world.vehicles
    ) as ClientVehicle;

    if (!localVehicle) return;

    const seatIndex = localVehicle.seats.findIndex(
      (seat) => seat.seater == player
    );
    if (seatIndex === -1) return;

    updatePlayerSeatTransform(player, localVehicle, seatIndex);
    updateLocalVehiclePrediction(localVehicle, delta);

    for (
      let seatIndex = 0;
      seatIndex < localVehicle.seats.length;
      seatIndex++
    ) {
      const seat = localVehicle.seats[seatIndex];
      if (seat.seater) {
        updatePlayerSeatTransform(seat.seater, localVehicle, seatIndex);
      }
    }
  } else {
    updateLocalCharacterPrediction(player, delta);
  }
}

// DebugState.instance.showGhost = true;
function animate(world: World) {
  stats.begin();
  const delta = clock.getDelta();

  if (!NetworkManager.instance.localId) return;
  const playerObject = world.getPlayerById(NetworkManager.instance.localId);
  if (!playerObject) return;

  updateLocalPlayer(playerObject, delta);

  // --- 3) Update world & visuals ---
  world.update(delta);
  updateCameraFollow(delta);
  // updateRecoil(delta);

  interpolatePlayers();
  interpolateVehicles();
  interpolateNPCs();

  world.players.forEach((p) => p.update(delta));

  // --- 4) Update UI ---
  if (playerObject) {
    const wantsToInteract = checkPlayerInteractables(playerObject, world);
    updateUI(playerObject, wantsToInteract);
  }

  ghostMesh.visible = DebugState.instance.showGhost;

  // --- 5) Render ---
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

  NetworkManager.instance.localId = socket.id;
  const player = new ClientPlayer(
    world,
    NetworkManager.instance.localId,
    "0xffffff",
    scene,
    true
  );
  world.addPlayer(player);

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
