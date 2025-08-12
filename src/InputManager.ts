export default class InputManager {
  private keys: Record<string, boolean> = {};
  private trackedKeys: string[] = ["w", "a", "s", "d", "shift", "e", " "];

  constructor() {
    this.init();
  }

  private init() {
    // Initialize all tracked keys to false
    for (const key of this.trackedKeys) {
      this.keys[key] = false;
    }

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

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

  public isKeyPressed(key: string): boolean {
    return !!this.keys[key.toLowerCase()];
  }

  public getState = () => {
    return {
      ...this.keys,
    };
  };

  public isMoving = () => {
    return this.keys["w"] || this.keys["a"] || this.keys["s"] || this.keys["d"];
  };

  public destroy() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }
}
