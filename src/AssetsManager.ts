import * as THREE from "three";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import AudioManager from "./AudioManager";

interface ModelData {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
}

interface ColliderData {
  vertices: Float32Array;
  indices: Uint16Array;
}

// Use import.meta.env.BASE_URL so paths work in dev & Electron build
const base = import.meta.env.BASE_URL;

const glbModels = [
  { key: "boxman", path: `${base}boxman_2.glb` },
  { key: "car", path: `${base}car.glb` },
  { key: "ramp", path: `${base}ramp.glb` },
];

const colliderNames = ["ramp"];
const COLLIDERS_PATH = `${base}colliders`;

export class AssetsManager {
  private static _instance: AssetsManager | null = null;

  private constructor() {}

  public static get instance(): AssetsManager {
    if (!this._instance) {
      this._instance = new AssetsManager();
    }
    return this._instance;
  }

  public models: Map<string, ModelData> = new Map();
  public colliders: Map<string, ColliderData> = new Map();

  async loadAll(): Promise<void> {
    // 1. Load all GLTF models in parallel
    await Promise.all(
      glbModels.map(async (model) => {
        this.models.set(model.key, await this.loadGLTF(model.path));
      })
    );

    // 2. Load all colliders in parallel
    await Promise.all(
      colliderNames.map(async (col) => {
        const data = await this.loadCollider(`${COLLIDERS_PATH}/${col}.json`);
        const object = {
          vertices: new Float32Array(Object.values(data.vertices)),
          indices: new Uint16Array(Object.values(data.indices)),
        };
        this.colliders.set(col, object);
      })
    );

    // 3. Load all audio after everything else
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

  private async loadCollider(url: string): Promise<ColliderData> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load collider: ${url}`);
    return (await res.json()) as ColliderData;
  }

  removeUnusedTracks(gltf: GLTF) {
    gltf.animations.forEach((clip: THREE.AnimationClip) => {
      for (let i = clip.tracks.length - 1; i >= 0; i--) {
        const track = clip.tracks[i];

        // Keep single-frame tracks — they define static poses
        if (track.times.length === 1) continue;

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

        if (delta === 0) clip.tracks.splice(i, 1);
      }
    });
  }

  getBoxmanClone():
    | { scene: THREE.Object3D; animations: THREE.AnimationClip[] }
    | undefined {
    if (!this.models.get("boxman")) return undefined;
    return {
      scene: clone(this.models.get("boxman")!.scene),
      animations: this.models
        .get("boxman")!
        .animations.map((clip) => clip.clone()),
    };
  }

  getRampClone(): { scene: THREE.Object3D } | undefined {
    if (!this.models.get("ramp")) {
      console.log("No ramp model", this.models.get("ramp"));
      return undefined;
    }

    return { scene: clone(this.models.get("ramp")!.scene) };
  }

  getCarClone(): { scene: THREE.Object3D } | undefined {
    if (!this.models.get("car")) {
      console.log("No car model", this.models.get("car"));
      return undefined;
    }

    return { scene: clone(this.models.get("car")!.scene) };
  }
}
