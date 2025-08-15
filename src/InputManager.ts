export default class InputManager {
  private keys: Record<string, boolean> = {};
  private prevKeys: Record<string, boolean> = {}; // <-- track last frame's state
  private trackedKeys: string[] = ["w", "a", "s", "d", "shift", "e", " "];
  private trackedMouse: string[] = ["mouseLeft", "mouseRight"];

  public static _instance: InputManager | null;

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
  }

  // --- Input Event Handlers ---
  private onKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (this.keys.hasOwnProperty(key)) {
      this.keys[key] = true;
    }
  };

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

  // --- State Query ---
  public isKeyPressed(key: string): boolean {
    return !!this.keys[key.toLowerCase()];
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
  }

  public destroy() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
  }
}
