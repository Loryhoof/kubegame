import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

interface ModelData {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
}

export class AssetsManager {
  private static _instance: AssetsManager | null = null;

  private constructor() {}

  public static get instance(): AssetsManager {
    if (!this._instance) {
      this._instance = new AssetsManager();
    }
    return this._instance;
  }

  private boxmanModel?: ModelData;

  async loadAll(): Promise<void> {
    this.boxmanModel = await this.loadGLTF("/boxman.glb");
  }

  private loadGLTF(url: string): Promise<ModelData> {
    return new Promise((resolve, reject) => {
      new GLTFLoader().load(
        url,
        (gltf) => {
          resolve({
            scene: gltf.scene,
            animations: gltf.animations,
          });
        },
        undefined,
        reject
      );
    });
  }

  getBoxmanClone():
    | { scene: THREE.Object3D; animations: THREE.AnimationClip[] }
    | undefined {
    if (!this.boxmanModel) return undefined;
    return {
      scene: clone(this.boxmanModel.scene),
      animations: this.boxmanModel.animations.map((clip) => clip.clone()),
    };
  }
}
