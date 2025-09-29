// Use import.meta.env.BASE_URL so paths work in dev & Electron build
const base = import.meta.env.BASE_URL;

export class GameManager {
  private static _instance: GameManager | null = null;

  private constructor() {}

  public static get instance(): GameManager {
    if (!this._instance) {
      this._instance = new GameManager();
    }
    return this._instance;
  }

  joinWorld(id: number = 0) {
    console.log("Joining world with id: ", id);

    window.dispatchEvent(
      new CustomEvent("join-world") //{ detail: { ready: true } }
    );
  }
}
