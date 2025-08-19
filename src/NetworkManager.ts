import { io, Socket } from "socket.io-client";

export default class NetworkManager {
  private static _instance: NetworkManager | null = null;
  private socket: Socket;

  private constructor() {
    this.socket = io((import.meta as any).env.VITE_SOCKET_URL);
  }

  public static get instance(): NetworkManager {
    if (!this._instance) {
      this._instance = new NetworkManager();
    }
    return this._instance;
  }

  getSocket() {
    return this.socket;
  }
}
