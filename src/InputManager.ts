import { WebGLRenderer } from "three";

type MobileEvent = {
  detail: { x: number; y: number };
};

type Action =
  | "moveForward"
  | "moveBackward"
  | "moveLeft"
  | "moveRight"
  | "jump"
  | "sprint"
  | "interact"
  | "reload"
  | "shoot"
  | "aim"
  | "spawnVehicle"
  | "useHorn";

type InputBinding = {
  type: "key" | "mouse" | "combo";
  code: string | number; // e.key for "key", e.button for "mouse"
  modifier?: "ctrl" | "shift" | "alt";
};

// ✅ Helper to initialize all actions as false
const makeEmptyActionState = (): Record<Action, boolean> => ({
  moveForward: false,
  moveBackward: false,
  moveLeft: false,
  moveRight: false,
  jump: false,
  sprint: false,
  interact: false,
  reload: false,
  shoot: false,
  aim: false,
  spawnVehicle: false,
  useHorn: false,
});

export default class InputManager {
  private static _instance: InputManager | null;

  private renderer: WebGLRenderer | null = null;
  private ignoreKeys = false;

  // store current pressed state
  private keys: Record<string, boolean> = {};
  private mouse: Record<number, boolean> = {};

  private prevActionState: Record<Action, boolean> = makeEmptyActionState();
  private actionState: Record<Action, boolean> = makeEmptyActionState();

  // Camera + mouse look state
  public cameraYaw: number = 0;
  public cameraPitch: number = 0;
  private cameraSensitivity: number = 0.002;
  public cameraDistance: number = 5;
  private mouseDeltaX: number = 0;
  private mouseDeltaY: number = 0;
  private mouseWheelDelta: number = 0;

  // --- bindings ---
  private bindings: Record<Action, InputBinding[]> = {
    moveForward: [{ type: "key", code: "w" }],
    moveBackward: [{ type: "key", code: "s" }],
    moveLeft: [{ type: "key", code: "a" }],
    moveRight: [{ type: "key", code: "d" }],
    jump: [{ type: "key", code: " " }],
    sprint: [{ type: "key", code: "shift" }],
    interact: [{ type: "key", code: "e" }],
    reload: [{ type: "key", code: "r" }],
    shoot: [{ type: "mouse", code: 0 }], // left mouse
    aim: [
      { type: "mouse", code: 2 }, // right mouse
      { type: "key", code: "control" }, // optional keyboard fallback
    ],
    spawnVehicle: [{ type: "key", code: "k" }],
    useHorn: [{ type: "key", code: "h" }],
  };

  private constructor() {
    this.init();
  }

  public static get instance(): InputManager {
    if (!this._instance) this._instance = new InputManager();
    return this._instance;
  }

  private init() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("mobile-controls", this.onMobileControls as any);
    window.addEventListener("mobile-buttons", this.onMobileButtons as any);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("wheel", this.onMouseWheel);
  }

  // --- event handlers ---
  private onKeyDown = (e: KeyboardEvent) => {
    if (this.ignoreKeys) return;
    this.keys[e.key.toLowerCase()] = true;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (this.ignoreKeys) return;
    this.keys[e.key.toLowerCase()] = false;
  };

  private onMouseDown = (e: MouseEvent) => {
    this.mouse[e.button] = true;
  };

  private onMouseUp = (e: MouseEvent) => {
    this.mouse[e.button] = false;
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.renderer) return;
    if (document.pointerLockElement !== this.renderer.domElement) return;

    // update yaw & pitch first
    this.cameraYaw -= e.movementX * this.cameraSensitivity;
    this.cameraPitch += e.movementY * this.cameraSensitivity;

    // aiming state → widen pitch range slightly
    const aiming = this.actionState.aim;

    // normal: 60° down, 15° up | aiming: 70° down, 40° up
    const maxPitch = aiming ? Math.PI / 2.5 : Math.PI / 3;
    const minPitch = aiming ? -Math.PI / 4.5 : -Math.PI / 12;

    this.cameraPitch = Math.max(minPitch, Math.min(maxPitch, this.cameraPitch));

    // store deltas for other systems
    this.mouseDeltaX += e.movementX;
    this.mouseDeltaY += e.movementY;
  };

  private onMouseWheel = (e: WheelEvent) => {
    if (this.ignoreKeys) return;
    const delta = e.deltaY + e.deltaX;
    this.mouseWheelDelta += delta;
    this.cameraDistance -= delta * 0.01;
    this.cameraDistance = Math.max(5, Math.min(10, this.cameraDistance));
  };

  private onMobileButtons = (e: any) => {
    const { action, pressed } = e.detail;
    this.setActionPressed(action as Action, pressed);
  };

  private onMobileControls = (e: MobileEvent) => {
    const { x, y } = e.detail;
    const threshold = 0.2;

    const dirMap: [Action, boolean][] = [
      ["moveForward", y < -threshold],
      ["moveBackward", y > threshold],
      ["moveLeft", x < -threshold],
      ["moveRight", x > threshold],
    ];

    for (const [action, pressed] of dirMap) {
      this.setActionPressed(action, pressed);
    }
  };

  // --- binding resolution ---
  private resolveBinding(b: InputBinding): boolean {
    switch (b.type) {
      case "key":
        return !!this.keys[b.code as string];
      case "mouse":
        return !!this.mouse[b.code as number];
      case "combo":
        return (
          !!this.mouse[b.code as number] &&
          b.modifier === "ctrl" &&
          (this.keys["control"] || this.keys["ctrl"])
        );
      default:
        return false;
    }
  }

  // --- helper to set an action's pressed state ---
  private setActionPressed(action: Action, pressed: boolean) {
    const binds = this.bindings[action];
    if (!binds) return;

    for (const b of binds) {
      switch (b.type) {
        case "key":
          this.keys[(b.code as string).toLowerCase()] = pressed;
          break;
        case "mouse":
          this.mouse[b.code as number] = pressed;
          break;
        case "combo":
          // combos need extra logic – usually handled in resolveBinding()
          // but we could still set the base input here
          if (typeof b.code === "number") {
            this.mouse[b.code] = pressed;
          } else {
            this.keys[(b.code as string).toLowerCase()] = pressed;
          }
          break;
      }
    }
  }

  private updateActions() {
    for (const action in this.bindings) {
      const binds = this.bindings[action as Action];
      this.actionState[action as Action] = binds.some((b) =>
        this.resolveBinding(b)
      );
    }
  }

  // --- public API ---
  public update() {
    this.prevActionState = { ...this.actionState };
    this.updateActions();
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
  }

  public getState() {
    return {
      ...this.actionState, // flattened actions
      raw: {
        keys: { ...this.keys },
        mouse: { ...this.mouse },
      },
    };
  }

  public getMouseDelta() {
    return { x: this.mouseDeltaX, y: this.mouseDeltaY };
  }

  public getMouseWheelDelta() {
    return this.mouseWheelDelta;
  }

  public isAction(action: Action): boolean {
    return !!this.actionState[action];
  }

  public isActionJustPressed(action: Action): boolean {
    return this.actionState[action] && !this.prevActionState[action];
  }

  public isActionJustReleased(action: Action): boolean {
    return !this.actionState[action] && this.prevActionState[action];
  }

  public setRenderer(r: WebGLRenderer) {
    this.renderer = r;
  }

  public getRenderer() {
    return this.renderer;
  }

  public isIgnoreInput(): boolean {
    return this.ignoreKeys;
  }

  public setIgnoreKeys(bool: boolean) {
    if (bool) {
      // reset all keys & mouse
      for (const k in this.keys) {
        this.keys[k] = false;
      }
      for (const b in this.mouse) {
        this.mouse[+b] = false;
      }

      // reset all actions
      for (const action in this.actionState) {
        this.actionState[action as Action] = false;
        this.prevActionState[action as Action] = false;
      }
    }

    this.ignoreKeys = bool;
  }

  public destroy() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("wheel", this.onMouseWheel);
  }
}
