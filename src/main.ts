// GameApp.ts
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

type NetworkPlayer = {
  id: string;
  position: { x: number; y: number; z: number };
  quaternion: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  color: string;
  health: number;
};

type UpdateData = {
  world: any;
  players: Record<string, NetworkPlayer>;
};

type UserActionData = {
  id: string;
  type: string;
  hasHit: boolean;
};

type StartOptions = {
  attachStats?: boolean; // optionally show fps panel
  container?: HTMLElement; // where to append the canvas (defaults to document.body)
};

class GameApp {
  private static _instance: GameApp | null = null;
  static instance(): GameApp {
    if (!GameApp._instance) GameApp._instance = new GameApp();
    return GameApp._instance;
  }

  private started = false;

  // Core engine bits
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private renderer?: THREE.WebGLRenderer;
  private world?: World;
  private clock?: THREE.Clock;
  private stats?: Stats;

  // Networking
  private socket: ReturnType<NetworkManager["getSocket"]> | null = null;
  private ping = 0;
  private pingIntervalId: number | null = null;

  // Players
  private localId: string | null = null;
  private networkPlayers = new Map<string, ClientPlayer>();
  private lastSentState: any = {};
  private worldIsReady = false;

  // Input / camera control
  private joystickX = 0;
  private joystickY = 0;
  private wantsToInteract = false;

  // DOM & listeners
  private containerEl: HTMLElement | null = null;
  private boundOnResize = () => this.resizeRenderer();
  private boundPointerLockClick = () => {
    if (this.renderer) this.renderer.domElement.requestPointerLock();
  };
  private boundCameraControls = (e: any) => {
    const { x, y } = e.detail;
    this.joystickX = x;
    this.joystickY = y;
  };

  private animationFrameId: number | null = null;

  private constructor() {}

  async start(opts: StartOptions = {}) {
    if (this.started) return;
    this.started = true;

    // Setup DOM target
    this.containerEl = opts.container ?? document.body;

    // Stats (optional)
    if (opts.attachStats) {
      this.stats = new Stats();
      this.containerEl.appendChild(this.stats.dom);
    }

    // Core Three.js
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x95f2f5);

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 2, 5);

    AudioManager.instance.attachToCamera(this.camera);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.containerEl.appendChild(this.renderer.domElement);

    // Input manager
    InputManager.instance.setRenderer(this.renderer);

    // World
    this.world = new World(this.scene);
    this.world.init();

    // Clock
    this.clock = new THREE.Clock();

    // Event listeners (attach only now)
    document.body.addEventListener("click", this.boundPointerLockClick);
    window.addEventListener("camera-controls", this.boundCameraControls as any);
    window.addEventListener("resize", this.boundOnResize);

    // Networking (connect only now)
    this.socket = NetworkManager.instance.getSocket();

    this.registerSocketHandlers();

    // Kick off ping checks (but only after socket is available)
    this.pingIntervalId = window.setInterval(() => {
      if (!this.socket) return;
      const start = Date.now();
      this.socket.emit("pingCheck", start);
    }, 3000);

    // Load assets & create local player
    await AssetsManager.instance.loadAll();

    // Ensure socket exists and has id (may be async until 'connect')
    if (this.socket?.id) {
      await this.finishInitAfterConnect();
    }
    // If not connected yet, finishInitAfterConnect will run from the 'connect' handler.
  }

  stop() {
    if (!this.started) return;
    this.started = false;

    // Cancel animation
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Remove DOM/event listeners
    document.body.removeEventListener("click", this.boundPointerLockClick);
    window.removeEventListener(
      "camera-controls",
      this.boundCameraControls as any
    );
    window.removeEventListener("resize", this.boundOnResize);

    // Stop ping interval
    if (this.pingIntervalId !== null) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }

    // Cleanup players
    this.networkPlayers.forEach((p) => p.remove());
    this.networkPlayers.clear();

    // Cleanup world
    if (this.world) {
      // If World exposes a dispose(), call it; otherwise rely on GC
      // @ts-ignore optional
      if (typeof this.world.dispose === "function") this.world.dispose();
    }

    // Disconnect socket & remove handlers
    if (this.socket) {
      this.unregisterSocketHandlers();
      if (this.socket.connected) this.socket.disconnect();
      this.socket = null;
    }

    // Remove renderer canvas
    if (this.renderer) {
      this.renderer.dispose?.();
      if (this.renderer.domElement?.parentElement) {
        this.renderer.domElement.parentElement.removeChild(
          this.renderer.domElement
        );
      }
      this.renderer = undefined;
    }

    // Stats panel
    if (this.stats && this.stats.dom.parentElement) {
      this.stats.dom.parentElement.removeChild(this.stats.dom);
      this.stats = undefined;
    }

    // Reset flags
    this.worldIsReady = false;
    this.localId = null;
    this.lastSentState = {};
    this.ping = 0;
  }

  // ---------- Socket handlers ----------
  private registerSocketHandlers() {
    if (!this.socket) return;

    this.socket.on("connect_error", (err: any) => {
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

    this.socket.on("connect", async () => {
      if (!this.socket) return;
      console.log("Connected with server with id:", this.socket.id);
      this.localId = this.socket.id!;
      await this.finishInitAfterConnect();
    });

    this.socket.on("pongCheck", (startTime: number) => {
      this.ping = Date.now() - startTime;
    });

    this.socket.on("initWorld", (data: any) => {
      this.world?.initWorldData(data);
    });

    this.socket.on("init-chat", (data: any) => {
      ChatManager.instance.init(data && data.messages ? data.messages : []);
    });

    this.socket.on("zoneCreated", (data: any) => this.world?.createZone(data));
    this.socket.on("addVehicle", (data: any) => this.world?.addVehicle(data));
    this.socket.on("interactableCreated", (data: any) =>
      this.world?.createInteractable(data)
    );

    this.socket.on("zoneRemoved", (uuid: string) =>
      this.world?.removeByUUID(uuid)
    );
    this.socket.on("interactableRemoved", (uuid: string) => {
      AudioManager.instance.playAudio("pickup", 0.1);
      this.world?.removeInteractableByUUID(uuid);
    });
    this.socket.on("vehicleRemoved", (uuid: string) =>
      this.world?.removeVehicleByUUID(uuid)
    );

    this.socket.on("user_action", (data: UserActionData) => {
      if (data.type !== "attack") return;

      const player = this.networkPlayers.get(data.id);
      if (!player) return;

      const animList = ["MeleeMotion", "MeleeMotion_2"];
      player.playAnimation(getRandomFromArray(animList));

      if (data.hasHit) {
        AudioManager.instance.playAudio("punch_impact", 0.5);
      }
    });

    this.socket.on("addPlayer", (playerId: string) => {
      const newPlayer = new ClientPlayer(playerId, "0xffffff", this.scene!);
      this.networkPlayers.set(playerId, newPlayer);
    });

    this.socket.on("removePlayer", (playerId: string) => {
      const player = this.networkPlayers.get(playerId);
      if (!player) return;
      player.remove();
      this.networkPlayers.delete(playerId);
    });

    this.socket.on("updateData", (data: UpdateData) => {
      if (!this.worldIsReady) return;

      for (const [key, value] of Object.entries(data.players)) {
        let netPlayer = this.networkPlayers.get(key);

        if (!netPlayer) {
          const newPlayer = new ClientPlayer(
            this.socket!.id!,
            "0xffffff",
            this.scene!
          );
          this.networkPlayers.set(key, newPlayer);
          netPlayer = this.networkPlayers.get(key)!;
        }

        netPlayer.setState(value as any);
      }

      this.world?.updateState(data.world);
    });
  }

  private unregisterSocketHandlers() {
    if (!this.socket) return;
    this.socket.removeAllListeners();
  }

  private async finishInitAfterConnect() {
    if (!this.socket || !this.scene) return;

    const player = new ClientPlayer(
      this.socket.id!,
      "0xffffff",
      this.scene,
      true
    );
    this.networkPlayers.set(this.socket.id!, player);

    this.animate();

    const event = new CustomEvent("loading-status", {
      detail: { ready: true },
    } as any);
    window.dispatchEvent(event);

    // Staggered ready to receive world state
    setTimeout(() => {
      if (!this.socket) return;
      this.worldIsReady = true;
      this.socket.emit("readyForWorld");
    }, 2000);
  }

  // ---------- Animation & per-frame ----------
  private animate = () => {
    if (!this.started) return;

    this.stats?.begin();

    const delta = this.clock?.getDelta() ?? 0;

    // local player input payload
    if (!this.localId || !this.socket) {
      this.scheduleNextFrame();
      this.stats?.end();
      return;
    }

    const playerObject = this.networkPlayers.get(this.localId);
    if (!playerObject || !this.camera) {
      this.scheduleNextFrame();
      this.stats?.end();
      return;
    }

    const payload = {
      keys: InputManager.instance.getState(),
      quaternion: this.camera.quaternion.clone(),
    };

    if (JSON.stringify(payload) !== JSON.stringify(this.lastSentState)) {
      this.socket.emit("playerInput", payload);
      this.lastSentState = payload;
    }

    this.world?.update();
    this.updateCameraFollow();

    this.networkPlayers.forEach((player: ClientPlayer) => {
      player.update(delta);
    });

    const localPlayer = this.networkPlayers.get(this.localId);
    if (localPlayer) {
      this.checkPlayerInteractables(localPlayer);
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }

    this.stats?.end();
    this.updateUI();
    InputManager.instance.update();

    this.scheduleNextFrame();
  };

  private scheduleNextFrame() {
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  private updateCameraFollow() {
    if (!this.localId) return;
    const player = this.networkPlayers.get(this.localId);
    if (!player || !this.camera) return;

    const playerPos = player.getPosition();
    const distance = InputManager.instance.cameraDistance;
    const height = 1;

    if (isMobile()) {
      const mobileSens = 0.08;
      InputManager.instance.cameraYaw -= this.joystickX * mobileSens;
      InputManager.instance.cameraPitch -= this.joystickY * mobileSens;
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

    this.camera.position.lerp(desiredPosition, 1);
    this.camera.lookAt(playerPos.x, playerPos.y + height, playerPos.z);
  }

  private updateUI() {
    if (!this.localId) return;

    const player = this.networkPlayers.get(this.localId);

    const eventData = {
      networkId: this.localId,
      position: {
        x: player?.getPosition().x,
        y: player?.getPosition().y,
        z: player?.getPosition().z,
      },
      health: player?.health,
      coins: player?.coins,
      playerCount: this.networkPlayers.size,
      ping: this.ping,
    };

    const event = new CustomEvent("player-update", {
      detail: eventData,
    } as any);
    window.dispatchEvent(event);

    const interactData = { wantsToInteract: this.wantsToInteract };
    const interactEvent = new CustomEvent("ui-update", {
      detail: interactData,
    });
    window.dispatchEvent(interactEvent);
  }

  private checkPlayerInteractables(player: ClientPlayer) {
    if (!this.world) return;

    let minDist = Infinity;

    type InteractableType = { id: string; mesh: THREE.Mesh };
    const interactables = this.world.interactables as InteractableType[];

    for (const interactable of interactables) {
      const dist = player.getPosition().distanceTo(interactable.mesh.position);
      if (dist < minDist) {
        minDist = dist;
      }
    }

    this.wantsToInteract = minDist <= 1.5;
  }

  private resizeRenderer() {
    if (!this.renderer || !this.camera) return;
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// Public API — NOTHING runs until start() is called.
export async function start(options?: StartOptions) {
  await GameApp.instance().start(options);
}

export function stop() {
  GameApp.instance().stop();
}
