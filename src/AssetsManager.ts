import * as THREE from "three";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import AudioManager from "./AudioManager";

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
  private carModel?: ModelData;

  async loadAll(): Promise<void> {
    this.boxmanModel = await this.loadGLTF("/boxman_2.glb");
    this.carModel = await this.loadGLTF("/car.glb");

    await AudioManager.instance.loadAll();
  }

  private loadGLTF(url: string): Promise<ModelData> {
    return new Promise((resolve, reject) => {
      new GLTFLoader().load(
        url,
        (gltf) => {
          this.removeUnusedTracks(gltf);
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

  removeUnusedTracks(gltf: GLTF) {
    gltf.animations.forEach((clip: THREE.AnimationClip) => {
      for (let i = clip.tracks.length - 1; i >= 0; i--) {
        const track = clip.tracks[i];

        // Keep single-frame tracks — they define static poses
        if (track.times.length === 1) {
          continue;
        }

        const numElements = track.values.length / track.times.length;

        let delta = 0;
        for (let e = 0; e < numElements; e++) {
          const valuesForElement = track.values.filter(
            (_, index) => index % numElements === e
          );
          const min = Math.min(...valuesForElement);
          const max = Math.max(...valuesForElement);
          delta += Math.abs(max - min);
        }

        if (delta === 0) {
          clip.tracks.splice(i, 1);
        }
      }
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

  getCarClone(): { scene: THREE.Object3D } | undefined {
    if (!this.carModel) {
      console.log("No car model", this.carModel);
      return undefined;
    }

    return {
      scene: clone(this.carModel.scene),
    };
  }
}
