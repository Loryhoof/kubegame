export default class DebugState {
  private static _instance: DebugState | null = null;

  public reconciliation: boolean = true;
  public showGhost: boolean = false;
  public buildVersion: string = "0.1.32 - Sep 30";

  public static get instance(): DebugState {
    if (!this._instance) {
      this._instance = new DebugState();
    }
    return this._instance;
  }

  private constructor() {}
}
