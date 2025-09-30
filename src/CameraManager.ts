import * as THREE from "three";

export default class CameraManager {
  private static _instance: CameraManager | null = null;

  private camera: THREE.PerspectiveCamera;

  private constructor() {
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      10000
    );

    this.camera.position.set(0, 2, 5);
  }

  public static get instance(): CameraManager {
    if (!this._instance) {
      this._instance = new CameraManager();
    }
    return this._instance;
  }

  getCamera() {
    return this.camera;
  }

  init(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }
}
