import { io, Socket } from "socket.io-client";

export default class NetworkManager {
  private static _instance: NetworkManager | null = null;
  private socket: Socket | null = null;
  public localId: string | null = null;
  public showUI: boolean = true;

  private constructor() {}

  public static get instance(): NetworkManager {
    if (!this._instance) {
      this._instance = new NetworkManager();
    }
    return this._instance;
  }

  getSocket(token: string) {
    if (!this.socket) {
      this.socket = io((import.meta as any).env.VITE_SOCKET_URL, {
        auth: {
          token,
        },
      });
    }
    return this.socket;
  }
}
