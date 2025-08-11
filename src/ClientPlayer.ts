import * as THREE from "three";
import { getAnimationByName } from "./utils";
import { AssetsManager } from "./AssetsManager";

const skinColor = 0xffe9c4;
const pantColor = 0x4756c9;

type StateData = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  velocity: THREE.Vector3;
  color: string;
  health: number;
  coins: number;
};

class ClientPlayer {
  public readonly networkId: string;
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public color: string;
  public health: number = 100;
  public coins: number = 0;
  public model: THREE.Object3D | any;
  public readonly scene: THREE.Scene;
  public readonly mixer: THREE.AnimationMixer;
  private dummy: THREE.Object3D = new THREE.Object3D();
  private hasInit: boolean = false;

  public readonly animations: Map<string, THREE.AnimationAction>;

  constructor(networkId: string, color: string, scene: THREE.Scene) {
    this.networkId = networkId;
    this.color = color;
    this.scene = scene;

    const modelScene = AssetsManager.instance.getBoxmanClone()?.scene;
    const modelAnims = AssetsManager.instance.getBoxmanClone()
      ?.animations as THREE.AnimationClip[];

    this.model = modelScene;

    this.mixer = new THREE.AnimationMixer(this.model);

    this.animations = new Map([
      ["Idle", this.mixer.clipAction(getAnimationByName(modelAnims, "Idle"))],
      ["Walk", this.mixer.clipAction(getAnimationByName(modelAnims, "Walk"))],
      [
        "WalkNew",
        this.mixer.clipAction(getAnimationByName(modelAnims, "WalkNew")),
      ],
    ]);

    this.scene.add(this.dummy);
    this.dummy.add(this.model);

    this.animations.get("Idle")?.play();
  }

  setPosition(position: THREE.Vector3) {
    this.dummy.position.copy(position);
  }

  setQuaternion(quaternion: THREE.Quaternion) {
    this.dummy.quaternion.copy(quaternion);
  }

  getPosition() {
    return this.dummy.position;
  }

  getQuaternion() {
    return this.dummy.quaternion;
  }

  remove() {
    this.scene.remove(this.dummy);
  }

  setState(state: StateData) {
    const { position, quaternion, color, health, coins, velocity }: StateData =
      state;

    this.coins = coins;
    this.color = color;
    this.velocity = velocity;
    this.health = health;

    this.dummy.position.copy(position);

    this.dummy.quaternion.slerp(
      new THREE.Quaternion(
        quaternion.x,
        quaternion.y,
        quaternion.z,
        quaternion.w
      ),
      0.15
    );

    if (!this.hasInit) {
      this.model.traverse((item: any) => {
        if (item instanceof THREE.SkinnedMesh) {
          if (item.name == "Torso") {
            item.material = new THREE.MeshStandardMaterial({ color: color });
          }
          if (item.name == "Arm_R") {
            item.material = new THREE.MeshStandardMaterial({ color: color });
          }
          if (item.name == "Arm_L") {
            item.material = new THREE.MeshStandardMaterial({ color: color });
          }
          if (item.name == "Leg_R") {
            item.material = new THREE.MeshStandardMaterial({
              color: pantColor,
            });
          }
          if (item.name == "Leg_L") {
            item.material = new THREE.MeshStandardMaterial({
              color: pantColor,
            });
          }
          if (item.name == "Head") {
            item.material = new THREE.MeshStandardMaterial({
              color: skinColor,
            });
          }
        }
      });
      this.hasInit = true;
    }
    this.animate();
  }

  animate() {
    const fadeDuration = 0.1;

    const idleAnim = this.animations.get("Idle");
    const walkAnim = this.animations.get("WalkNew");

    const velMag = new THREE.Vector3(
      this.velocity.x,
      this.velocity.y,
      this.velocity.z
    ).length();

    if (walkAnim && idleAnim) {
      if (velMag > 0) {
        // switch to walk
        if (!walkAnim.isRunning()) {
          walkAnim.reset().play();
          idleAnim.crossFadeTo(walkAnim, fadeDuration, false);
        }
      } else {
        // switch to idlex
        if (!idleAnim.isRunning()) {
          idleAnim.reset().play();
          walkAnim.crossFadeTo(idleAnim, fadeDuration, false);
        }
      }
    }
  }

  update(delta: number) {
    this.mixer.update(delta);
  }
}

export default ClientPlayer;
