import * as THREE from "three";
import World, { WorldStateData } from "./World";
import InputManager from "./InputManager";
import ClientPlayer, { ItemSlot } from "./ClientPlayer";
import { AssetsManager } from "./AssetsManager";
import {
  createToast,
  getRandomFromArray,
  isMobile,
  parseInviteURL,
} from "./utils";
import AudioManager from "./AudioManager";

import Stats from "stats.js";
import NetworkManager from "./NetworkManager";
import ChatManager from "./ChatManager";
import ClientVehicle from "./ClientVehicle";
import CameraManager from "./CameraManager";
import DebugState from "./state/DebugState";
import ClientWeapon from "./ClientWeapon";
import { USER_SETTINGS_LOCAL_STORE } from "./constants";
import { Socket } from "socket.io-client";
import ClientPhysics from "./ClientPhysics";
import RAPIER from "@dimforge/rapier3d-compat";
import { deserializeBinaryWorld, deserializePlayer } from "./serializeHelper";
import ClientNPC from "./ClientNPC";

let world: World | null = null;

export type ServerNotification = {
  type: "error" | "success" | "info" | "achievement";
  content: string;
  duration?: number;
};

export type LocalUserSettings = {
  nickname?: string;
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
  ammo: number;
  keys: any;
  isSitting: boolean;
  controlledObject: any;
  lastProcessedInputSeq?: number;
  nickname: string;
  leftHand: any;
  rightHand: any;
  viewQuaternion: { x: number; y: number; z: number; w: number };
  isDead: boolean;
  killCount: number;
  lobbyId: string;
  selectedItemSlot: number;
  itemSlots: ItemSlot[];
};

let ping = 0;

// Scene
let scene = new THREE.Scene();
scene.background = new THREE.Color(0x95f2f5);

// Camera
const camera = CameraManager.instance.getCamera();
AudioManager.instance.attachToCamera(camera);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(1.5);
renderer.setSize(window.innerWidth, window.innerHeight);

// Input manager
const inputManager = InputManager.instance;
inputManager.setRenderer(renderer);

// Pointer lock

// Mobile joystick control
const mobileSens = 0.08;
let joystickX = 0;
let joystickY = 0;

// Networking
let socket: Socket | null = null;

function registerEventListeners() {
  // pointer lock
  document.body.addEventListener("click", () => {
    if (!InputManager.instance.isIgnoreInput())
      renderer.domElement.requestPointerLock();
  });

  // mobile joystick camera
  window.addEventListener("camera-controls", (e: any) => {
    const { x, y } = e.detail;
    joystickX = x;
    joystickY = -y;
  });

  // canvas resize
  window.addEventListener("resize", resizeRenderer);

  // add renderer
  document.body.appendChild(renderer.domElement);
}

function registerSocketEvents(world: World) {
  if (!socket) return;

  setInterval(() => {
    const start = Date.now();
    socket?.emit("pingCheck", start);
  }, 3000);

  function syncTime() {
    if (!socket) return;

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

  // minigames

  type MinigameStartData = {
    type: "race" | "deathmatch";
    startTime: number;
  };

  type MinigameEndData = {
    type: "race" | "deathmatch";
    totalTime: number;
  };

  socket.on("minigame-start", (data: MinigameStartData) => {
    const { type, startTime } = data;

    if (type == "race") {
      window.dispatchEvent(new CustomEvent("minigame-start", { detail: data }));
    }
  });

  socket.on("minigame-end", (data: MinigameEndData) => {
    const { type, totalTime } = data;

    if (type == "race") {
      window.dispatchEvent(new CustomEvent("minigame-end", { detail: data }));
    }
  });

  socket.on("minigame-cancel", () => {
    window.dispatchEvent(new CustomEvent("minigame-cancel"));
  });

  //

  socket.on("pongCheck", (startTime: number) => {
    ping = Date.now() - startTime;
  });

  socket.on("initWorld", (data: any) => {
    const { players } = data;

    if (players) {
      for (const [id, value] of Object.entries(players)) {
        const player = world.getPlayerById(id);

        console.log(player, "WE DO HAVE PLAYER");

        if (player) continue;

        console.log(player, "WE DO NOT HAVE PLAYER");

        console.log(id, "ID OF CREATED PLAYER");

        const newPlayer = new ClientPlayer(world, id, "0xffffff", scene);
        world.addPlayer(newPlayer);
      }
    }

    world.initWorldData(data);
  });

  socket.on("switch-world", (data: any) => {
    scene.clear();
    world.restart();

    const settings = getLocalUserSettings();
    if (settings) socket?.emit("init-user-settings", settings);

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

    const p = new ClientPlayer(
      world,
      socket!.id as string,
      "0xffffff",
      scene,
      true
    );
    world.addPlayer(p);
  });

  socket.on("init-chat", (data: any) => {
    ChatManager.instance.init(data && data.messages ? data.messages : []);
  });

  socket.on("server-notification", (data: ServerNotification) => {
    if ((data as any).recipient != NetworkManager.instance.localId) return;

    if (data.type == "achievement")
      AudioManager.instance.playAudio("achievement");

    createToast(data);
  });

  socket.on("zoneCreated", (data: any) => {
    console.log("ZONE CREATED", data);
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
            0.2
            // randFloat(1, 1000)
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

  socket.on(
    "shot-fired",
    (data: { position: { x: number; y: number; z: number } }) => {
      const { x, y, z } = data.position;

      const buffer = AudioManager.instance.getBufferByName("pistol_shot_1");
      if (!buffer) return;

      // Create positional audio
      const audio = new THREE.PositionalAudio(
        AudioManager.instance.getListener()
      );
      audio.setBuffer(buffer);

      // // Config spatial sound
      // audio.setRefDistance(8); // full volume within 8 units
      // audio.setMaxDistance(50); // fades out by 50 units
      // audio.setDistanceModel("linear");
      // audio.setVolume(0.8);

      // Attach audio to a temp object at the shot location
      const tempObj = new THREE.Object3D();
      tempObj.position.set(x, y, z);
      tempObj.add(audio);
      scene.add(tempObj);

      // Play
      audio.play();

      // Cleanup when sound finishes
      audio.onEnded = () => {
        tempObj.remove(audio);
        scene.remove(tempObj);
        audio.disconnect();
      };
    }
  );

  socket.on("player-death", (playerId: string) => {
    const player = world.getPlayerById(playerId);

    if (!player) return;
    player.die();

    onDeathEvent(player);
  });

  socket.on("player-respawn", (playerId: string) => {
    const player = world.getPlayerById(playerId);

    if (!player) return;

    player.respawn();

    onRespawnEvent(player);
  });

  type DataEvent = {
    id: string;
    event: string;
    payload?: any;
  };

  socket.on("npc-event", (data: DataEvent) => {
    const { id, event } = data;

    const npc = world.getObjById(id, world.npcs) as ClientNPC;

    if (!npc) return;

    if (event == "init") {
      npc.setInitState(data.payload);
    }

    if (event == "update-health") {
      const value = data.payload.value;
      npc.setHealth(value);
    }
  });

  socket.on("player-event", (data: DataEvent) => {
    const { id, event } = data;

    const player = world.getPlayerById(id);

    if (!player) return;

    if (event == "respawn") {
      console.log("RESPAWNING");
    }

    if (event == "update-coins") {
      const coins = data.payload.value;
      player.coins = coins;
    }

    if (event == "enter-vehicle") {
      const vehicle = world.getObjById(data.payload.id, world.vehicles);
      player.controlledObject = vehicle;
    }

    if (event == "exit-vehicle") {
      player.controlledObject = null;
    }

    if (event == "player-init") {
      player.setInitState(data.payload);
    }

    if (event == "reload-weapon") {
      const { amount, ammo, duration } = data.payload;

      const weapon = player.getHandItem() as ClientWeapon;

      if (weapon) {
        player.ammo = ammo;
        weapon.isReloading = true;

        setTimeout(() => {
          weapon.ammo += amount;
          weapon.isReloading = false;
        }, duration);
      }
    }

    if (event == "update-selected-slot") {
      const value = data.payload.value;
      player.setSelectedItemSlot(value);
    }

    if (event == "update-health") {
      const value = data.payload.value;
      player.setHealth(value);
    }
  });
  socket.on("addPlayer", (playerId: string) => {
    const newPlayer = new ClientPlayer(world, playerId, "0xffffff", scene);
    world.addPlayer(newPlayer);
    // console.log(
    //   "Added remote player",
    //   playerId,
    //   newPlayer.model.position.toArray(),
    //   newPlayer.model.visible,
    //   scene
    // );
  });

  socket.on("removePlayer", (playerId: string) => {
    world.removePlayer(playerId);
  });

  socket.on("updateBinary", (data: ArrayBuffer) => {
    if (!worldIsReady || !NetworkManager.instance.localId) return;

    // ✅ Decode full binary world snapshot (time + players + vehicles + npcs)
    const { time, players, vehicles, npcs } = deserializeBinaryWorld(data);

    // console.log(players, "players");
    if (!players || Object.keys(players).length === 0) return;

    const localId = NetworkManager.instance.localId;

    // ✅ Reconcile local player
    const serverState = players[localId];
    if (serverState) {
      if (DebugState.instance.reconciliation) {
        reconcileLocalPlayer(serverState as any);
      }
      delete players[localId]; // prevent overwriting our predicted local
    }

    const localPlayer = world.getPlayerById(localId);

    if (localPlayer && localPlayer.controlledObject) {
      // console.log(vehicles, localPlayer.controlledObject);
      const serverVehicle = vehicles?.find(
        (veh: any) => veh.id == localPlayer.controlledObject!.id
      );

      if (serverVehicle) {
        if (DebugState.instance.reconciliation)
          reconcileLocalVehicle(serverVehicle);
      }
    }

    // ✅ Update vehicle + NPC states instantly (same as old updateData)
    if (vehicles?.length || npcs?.length) {
      const data: WorldStateData = {
        vehicles: vehicles as ClientVehicle[],
        npcs: npcs as any,
      };
      world.updateState(data);
    }

    // console.log(time, players, vehicles, npcs);

    // ✅ Store snapshot for interpolation (players, vehicles, npcs)

    // console.log(players, "PLAYERS", time);

    snapshotBuffer.push({
      time: time,
      players: players,
      vehicles: vehicles,
      npcs: npcs,
    });

    if (snapshotBuffer.length > 50) snapshotBuffer.shift();
  });

  // socket.on("updateData", (data) => {
  //   if (!worldIsReady || !NetworkManager.instance.localId) return;

  //   // fake ping`

  //   // handle local separately
  //   const serverState = data.players[
  //     NetworkManager.instance.localId
  //   ] as ClientPlayer;

  //   if (serverState) {
  //     if (DebugState.instance.reconciliation) {
  //       const decoded = deserializePlayer(serverState);
  //       reconcileLocalPlayer(decoded as any);
  //     }

  //     delete data.players[NetworkManager.instance.localId];
  //   }

  //   if (serverState.controlledObject) {
  //     const serverVehicle = data.world.vehicles?.find(
  //       (veh: any) => veh.id == serverState.controlledObject!.id
  //     );

  //     if (serverVehicle) {
  //       if (DebugState.instance.reconciliation)
  //         reconcileLocalVehicle(serverVehicle);
  //     }
  //   }

  //   snapshotBuffer.push({
  //     time: data.time,
  //     players: data.players,
  //     vehicles: data.world.vehicles,
  //     npcs: data.world.npcs,
  //   });

  //   if (snapshotBuffer.length > 50) snapshotBuffer.shift();
  //   world.updateState(data.world);
  // });
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

function reconcileLocalPlayer(serverState: NetworkPlayer) {
  if (!serverState) return;

  if (!worldIsReady || !NetworkManager.instance.localId) return;

  const player = world?.getPlayerById(NetworkManager.instance.localId);
  if (!player) return;

  player.setState(serverState as any);

  if (player.controlledObject) return;

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
  const localVehicle = world?.getObjById(
    serverVehicle.id,
    world.vehicles
  ) as ClientVehicle;

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

  localVehicle.hornPlaying = serverVehicle.hornPlaying;

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
const serverTickMs = 1000 / DebugState.instance.serverHz;

function interpolatePlayers() {
  if (!worldIsReady || !NetworkManager.instance.localId) return;

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
        ammo: pNew.ammo,
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
        isDead: pNew.isDead,
        killCount: pNew.killCount,
        lobbyId: pNew.lobbyId,
        selectedItemSlot: pNew.selectedItemSlot,
        itemSlots: pNew.itemSlots,
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
          // seat.seater.setPosition(seat.position);
          //updatePlayerSeatTransform(seat.seater, clientVehicle, seatIndex);
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
        // color: pNew.color,
        // health: pNew.health,
        // coins: pNew.coins,
        velocity: targetVel,
        keys: pNew.keys,
        // isSitting: pNew.isSitting,
        // controlledObject: pNew.controlledObject,

        // leftHand: pNew.leftHand,
        // rightHand: pNew.rightHand,
        viewQuaternion: new THREE.Quaternion(
          pNew.viewQuaternion.x,
          pNew.viewQuaternion.y,
          pNew.viewQuaternion.z,
          pNew.viewQuaternion.w
        ),
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
  const inVehicle = player.controlledObject != null;

  if (inVehicle && player.rightHand.item) return 1;

  if (!inVehicle && player.rightHand.item) return 2;

  return 3;
}

let currentCameraDistance = InputManager.instance.cameraDistance; // persistent between frames

function updateCameraFollow(delta: number) {
  if (!NetworkManager.instance.localId) return;
  const player = world?.getPlayerById(NetworkManager.instance.localId);
  if (!player || player.isDead) return;

  const input = InputManager.instance.getState();
  const aiming = input.aim;
  const playerPos = player.getPosition();
  const rightHandItem = player.rightHand?.item as ClientWeapon;
  const inVehicle = player.controlledObject != null;

  // --- Smooth aiming transition only (unchanged) ---
  const aimTarget = aiming ? 1 : 0;
  aimBlend = THREE.MathUtils.lerp(
    aimBlend,
    aimTarget,
    1 - Math.exp(-delta * 20)
  );

  // --- Mobile joystick input ---
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

  // --- Distance + side offset ---
  const baseDistance = InputManager.instance.cameraDistance;
  const aimDistance = getAimDistance(player);
  const desiredDistance = THREE.MathUtils.lerp(
    baseDistance,
    aimDistance,
    aimBlend
  );

  const sideOffsetAmount = rightHandItem
    ? THREE.MathUtils.lerp(0, 0.5, aimBlend)
    : 0;

  const height = inVehicle && aiming ? 0.6 : 0.75;
  const headPos = playerPos.clone().add(new THREE.Vector3(0, height, 0));

  const sideOffset = new THREE.Vector3(sideOffsetAmount, 0, 0);
  const rotatedSide = sideOffset.clone().applyQuaternion(camRot);

  // --------------------------------------------------------------------
  // --- Multi-ray camera collision check (instant in, smooth out) ---
  // --------------------------------------------------------------------
  const rapierWorld = ClientPhysics.instance.physicsWorld;
  let targetZDist = desiredDistance;
  let hitSomething = false;

  if (rapierWorld) {
    // build total offset direction (Z backward)
    const totalOffset = new THREE.Vector3(0, 0, desiredDistance);
    const offsetDir = totalOffset.clone().normalize().applyQuaternion(camRot);
    const maxDist = desiredDistance;

    // approximate sphere collision using 5 rays
    const offsets = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.25, 0, 0),
      new THREE.Vector3(-0.25, 0, 0),
      new THREE.Vector3(0, 0.25, 0),
      new THREE.Vector3(0, -0.25, 0),
    ];

    let minHit = Infinity;

    for (const o of offsets) {
      const origin = headPos.clone().add(o.applyQuaternion(camRot));
      const ray = new RAPIER.Ray(origin, offsetDir);
      const hit = rapierWorld.castRay(
        ray,
        maxDist,
        true,
        undefined,
        undefined,
        undefined,
        player.physicsObject.rigidBody
      );

      if (hit && hit.timeOfImpact < minHit) {
        minHit = hit.timeOfImpact;
        hitSomething = true;
      }
    }

    if (hitSomething) {
      const cameraRadius = 0.3; // physical buffer before wall
      const safeDist = Math.max(minHit - cameraRadius, 0.1);
      targetZDist = Math.min(safeDist, desiredDistance);
    }
  }

  // --- Z offset behavior: instant in, smooth out ---
  if (hitSomething) {
    // Snap in immediately if camera collides
    currentCameraDistance = targetZDist;
  } else {
    // Smoothly restore distance when free
    const smoothingSpeed = 6; // lower = slower restore
    currentCameraDistance = THREE.MathUtils.lerp(
      currentCameraDistance,
      targetZDist,
      1 - Math.exp(-delta * smoothingSpeed)
    );
  }

  // --- Final camera position ---
  const backOffset = new THREE.Vector3(
    0,
    0,
    currentCameraDistance
  ).applyQuaternion(camRot);
  const finalCameraPos = headPos.clone().add(rotatedSide).add(backOffset);
  const lookAtPoint = headPos.clone().add(rotatedSide);

  updateRecoil(delta, aiming);

  // --- Apply instantly (no smoothing except z distance) ---
  camera.position.copy(finalCameraPos);
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

function onDeathEvent(player: ClientPlayer) {
  if (!player.isLocalPlayer) return;

  const eventData = {
    isDead: true,
    state: {
      kills: player.killCount,
    },
  };

  window.dispatchEvent(new CustomEvent("ui-state", { detail: eventData }));
  window.dispatchEvent(new CustomEvent("reset-controls"));
}

function onRespawnEvent(player: ClientPlayer) {
  if (!player.isLocalPlayer) return;

  const eventData = {
    isDead: false,
    state: null,
  };

  window.dispatchEvent(new CustomEvent("ui-state", { detail: eventData }));
}

// ---------------- UI ----------------
function updateUI(player: ClientPlayer, wantsToInteract: boolean) {
  const showCrosshair =
    !player.isDead &&
    player.rightHand.item != null &&
    InputManager.instance.getState().aim;

  const eventData = {
    networkId: NetworkManager.instance.localId,
    position: player.getPosition(),
    health: player.health,
    coins: player.coins,
    playerCount: world?.players.size,
    ping: ping,
    showCrosshair: showCrosshair,
    weapon: player.rightHand.item,
    ammo: player.ammo,
    isDead: player.isDead,
    lobbyDetails: world?.lobbyDetails,
    selectedItemSlot: player.selectedItemSlot,
    itemSlots: player.itemSlots,
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
    const actions = InputManager.instance.getState();
    const input = {
      type: "character",
      seq: inputSeq++,
      dt: FIXED_DT,
      actions: actions,
      camQuat: camera.quaternion.clone(),
      camPos: camera.position.clone(),
    };
    pendingInputs.push(input);
    socket?.emit("playerInput", input);

    // Predict immediately for responsiveness
    playerObject.predictMovement(FIXED_DT, actions, input.camQuat);
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
      // for chatgpt.. the issue happens i think cuz we calling this again.. i think it's overriding the quat or smth..
      for (const pending of pendingInputs) {
        playerObject.predictMovement(
          pending.dt,
          pending.keys,
          pending.camQuat,
          false
        );
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
    const actions = InputManager.instance.getState();
    const input = {
      type: "vehicle",
      seq: vehicleInputSeq++,
      actions: actions,
      dt: FIXED_DT,
      camQuat: camera.quaternion.clone(),
      camPos: camera.position.clone(),
    };
    pendingVehicleInputs.push(input);
    socket!.emit("vehicleInput", input);

    // Predict immediately for responsiveness
    vehicle.predictMovementCustom(actions);
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

let prevRespawn = false;

function updateLocalPlayer(player: ClientPlayer, delta: number) {
  const input = InputManager.instance.getState();

  if (player.isDead) {
    const respawnPressed = input.reload && !prevRespawn;

    if (!player.onDeathScreen) {
      onDeathEvent(player);
      player.onDeathScreen = true;
    }

    if (respawnPressed) {
      socket!.emit("player-respawn");
    }

    prevRespawn = input.reload;

    return;
  }

  const aiming = input.aim;
  const shooting = input.shoot && aiming;
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
    // console.log("Player have controlled object", player.controlledObject);
    const localVehicle = world?.getObjById(
      player.controlledObject.id,
      world.vehicles
    ) as ClientVehicle;

    if (!localVehicle) return;

    const seatIndex = localVehicle.seats.findIndex(
      (seat) => seat.seater == player
    );
    if (seatIndex === -1) return;

    ///updatePlayerSeatTransform(player, localVehicle, seatIndex);

    updateLocalVehiclePrediction(localVehicle, delta);

    for (
      let seatIndex = 0;
      seatIndex < localVehicle.seats.length;
      seatIndex++
    ) {
      const seat = localVehicle.seats[seatIndex];
      if (seat.seater) {
        // seat.seater.setPosition(seat.position);
        //updatePlayerSeatTransform(seat.seater, localVehicle, seatIndex);
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

  // updateRecoil(delta);

  interpolatePlayers();
  interpolateVehicles();
  interpolateNPCs();

  world.vehicles.forEach((v) => {
    for (let i = 0; i < v.seats.length; i++) {
      const s = v.seats[i];
      if (s.seater) updatePlayerSeatTransform(s.seater, v, i);
    }
  });

  updateCameraFollow(delta);

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

function getLocalUserSettings(): LocalUserSettings | null {
  const settings = localStorage.getItem(USER_SETTINGS_LOCAL_STORE) as string;

  if (!settings) return null;

  return JSON.parse(settings);
}

function resizeRenderer() {
  // update renderer canvas size
  renderer.setSize(window.innerWidth, window.innerHeight);

  // update camera aspect ratio
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

async function startConnection(token: string) {
  socket = NetworkManager.instance.getSocket(token);

  if (!socket) return;

  socket.on("connect", () => {
    console.log("Connected with auth, id:", socket?.id);
    init();
  });

  socket.on("connect_error", (err: any) => {
    console.error("Socket auth error:", err);

    // If token failed → force logout
    localStorage.removeItem("jwt");
    window.location.href = "/";
  });
}

// async function startConnection() {
//   socket = NetworkManager.instance.getSocket();

//   if (!socket) return;
//   socket.on("connect", () => {
//     console.log("Connected with server with id:", socket?.id);
//     init();
//   });

//   socket.on("connect_error", (err: any) => {
//     console.error("Socket connection error:", err);
//     window.dispatchEvent(
//       new CustomEvent("loading-status", {
//         detail: {
//           error: {
//             title: "Connection error",
//             info: "The server appears to be unreachable, please try again later",
//           },
//         },
//       })
//     );
//   });
// }

function resetWorld() {
  console.log("Resetting world...");

  // Stop rendering & updates
  worldIsReady = false;

  // Cleanup world scene
  if (world) {
    try {
      world.cleanup(); // custom cleanup for meshes, physics, npcs, vehicles
    } catch (e) {
      console.warn("World cleanup error:", e);
    }
    world = null;
  }

  // Clear scene completely
  if (scene) {
    scene.clear();
  }

  // Reset globals
  snapshotBuffer.length = 0;
  inputSeq = 0;
  vehicleInputSeq = 0;
  pendingInputs = [];
  pendingVehicleInputs = [];
  accumulator = 0;

  // Reset camera position and rotation
  camera.position.set(0, 0, 0);
  camera.rotation.set(0, 0, 0);

  // // Reset UI
  // window.dispatchEvent(
  //   new CustomEvent("loading-status", { detail: { ready: false } })
  // );

  console.log("World reset complete. Socket and network kept alive.");
}

// ---------------- Init ----------------
async function init() {
  if (!socket || socket == null) {
    console.log("No socket");
    return;
  }

  const assetsManager = AssetsManager.instance;
  await assetsManager.loadAll();

  world = new World(scene, "some_id");
  await world.init();

  if (!socket || !socket.id) {
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

  registerEventListeners();

  registerSocketEvents(world);
  animate(world);

  window.dispatchEvent(
    new CustomEvent("loading-status", { detail: { ready: true } })
  );

  resizeRenderer();

  setTimeout(() => {
    worldIsReady = true;

    const lobbyId = parseInviteURL();

    socket?.emit("readyForWorld", { inviteId: lobbyId });

    const settings = getLocalUserSettings();
    if (settings) socket?.emit("init-user-settings", settings);
  }, 2000);
}

window.addEventListener("join-world", async () => {
  console.log("joining world...");

  const token = localStorage.getItem("jwt");
  if (!token) {
    window.location.href = "/"; // go back to login screen
    return;
  }

  await startConnection(token);
});
