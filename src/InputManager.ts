import { WebGLRenderer } from "three";

type MobileEvent = {
  detail: {
    x: number;
    y: number;
  };
};

export default class InputManager {
  private keys: Record<string, boolean> = {};
  private prevKeys: Record<string, boolean> = {}; // <-- track last frame's state
  private trackedKeys: string[] = [
    "w",
    "a",
    "s",
    "d",
    "shift",
    "e",
    " ",
    "r",
    "k",
  ];
  private trackedMouse: string[] = ["mouseLeft", "mouseRight"];

  private mouseDeltaX: number = 0;
  private mouseDeltaY: number = 0;

  private mouseWheelDelta: number = 0;

  public cameraYaw: number = 0;
  public cameraPitch: number = 0;
  private cameraSensitivity: number = 0.002;
  public cameraDistance: number = 5;

  public static _instance: InputManager | null;

  private isReady: boolean = false;

  private renderer: WebGLRenderer | null = null;

  private constructor() {
    this.init();
  }

  public static get instance(): InputManager {
    if (!this._instance) {
      this._instance = new InputManager();
    }
    return this._instance;
  }

  private init() {
    // Initialize all tracked keys to false
    for (const key of this.trackedKeys) {
      this.keys[key] = false;
      this.prevKeys[key] = false;
    }

    // Initialize tracked mouse buttons to false
    for (const mouseKey of this.trackedMouse) {
      this.keys[mouseKey] = false;
      this.prevKeys[mouseKey] = false;
    }

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("mobile-controls", this.onMobileControls as any);
    window.addEventListener("mobile-buttons", this.onMobileButtons as any);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("wheel", this.onMouseWheel);
  }

  private onMouseWheel = (e: WheelEvent) => {
    const delta = e.deltaY + e.deltaX;

    this.mouseWheelDelta += delta;

    this.cameraDistance -= delta * 0.01;
    this.cameraDistance = Math.max(5, Math.min(10, this.cameraDistance));
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.renderer) return;

    if (document.pointerLockElement !== this.renderer.domElement) return;

    this.cameraYaw -= e.movementX * this.cameraSensitivity;
    this.cameraPitch -= e.movementY * this.cameraSensitivity;

    const maxPitch = Math.PI / 3;
    const minPitch = -Math.PI / 12;
    this.cameraPitch = Math.max(minPitch, Math.min(maxPitch, this.cameraPitch));

    this.mouseDeltaX += e.movementX;
    this.mouseDeltaY += e.movementY;
  };
  // --- Input Event Handlers ---
  private onKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (this.keys.hasOwnProperty(key)) {
      this.keys[key] = true;
    }
  };

  public getMouseWheelDelta() {
    return this.mouseWheelDelta;
  }

  public getMouseDelta() {
    return { x: this.mouseDeltaX, y: this.mouseDeltaY };
  }

  public setIsReady(val: boolean) {
    this.isReady = val;
  }

  public setRenderer(renderer: WebGLRenderer) {
    this.renderer = renderer;
  }

  private onKeyUp = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (this.keys.hasOwnProperty(key)) {
      this.keys[key] = false;
    }
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) this.keys["mouseLeft"] = true;
    if (e.button === 2) this.keys["mouseRight"] = true;
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.keys["mouseLeft"] = false;
    if (e.button === 2) this.keys["mouseRight"] = false;
  };

  private onMobileButtons = (e: any) => {
    const { key, pressed } = e.detail;

    this.keys[key] = pressed;
  };

  private onMobileControls = (e: MobileEvent) => {
    const { x, y } = e.detail;

    // Reset keys first
    this.keys["w"] = false;
    this.keys["s"] = false;
    this.keys["a"] = false;
    this.keys["d"] = false;

    // Threshold to avoid tiny joystick jitters
    const threshold = 0.2;

    // Vertical movement
    if (y > threshold) this.keys["s"] = true;
    if (y < -threshold) this.keys["w"] = true;

    // Horizontal movement
    if (x > threshold) this.keys["d"] = true;
    if (x < -threshold) this.keys["a"] = true;
  };

  // --- State Query ---
  public isKeyPressed(key: string): boolean {
    return !!this.keys[key];
  }

  public isJustPressed(key: string): boolean {
    key = key.toLowerCase();
    return this.keys[key] && !this.prevKeys[key];
  }

  public isJustReleased(key: string): boolean {
    key = key.toLowerCase();
    return !this.keys[key] && this.prevKeys[key];
  }

  public getState = () => {
    return { ...this.keys };
  };

  public isMoving = () => {
    return this.keys["w"] || this.keys["a"] || this.keys["s"] || this.keys["d"];
  };

  // --- Call once per frame ---
  public update() {
    // Save current state to prevKeys for next frame's comparisons
    this.prevKeys = { ...this.keys };

    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
  }

  public destroy() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
  }
}
