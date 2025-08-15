import * as THREE from "three";
import { getAnimationByName, getRandomFromArray } from "./utils";
import { AssetsManager } from "./AssetsManager";
import AudioManager from "./AudioManager";
import InputManager from "./InputManager";

const skinColor = 0xffe9c4;
const pantColor = 0x4756c9;

type StateData = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  velocity: THREE.Vector3;
  color: string;
  health: number;
  coins: number;
  keys: any;
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
  private keys: Record<string, boolean> = {};

  public boundingBox: THREE.Box3;
  public readonly animations: Map<string, THREE.AnimationAction>;
  public wantsToAttack: boolean = false;
  public isAttacking: boolean = false;
  private currentAnimation: string | null = null;
  private isLocalPlayer: boolean = false;

  constructor(networkId: string, color: string, scene: THREE.Scene) {
    this.networkId = networkId;
    this.color = color;
    this.scene = scene;

    const modelScene = AssetsManager.instance.getBoxmanClone()?.scene;
    const modelAnims = AssetsManager.instance.getBoxmanClone()
      ?.animations as THREE.AnimationClip[];

    this.model = modelScene;
    this.mixer = new THREE.AnimationMixer(this.model);

    // Load animations
    this.animations = new Map([
      ["Idle", this.mixer.clipAction(getAnimationByName(modelAnims, "Idle"))],
      ["Walk", this.mixer.clipAction(getAnimationByName(modelAnims, "Walk"))],
      [
        "WalkNew",
        this.mixer.clipAction(getAnimationByName(modelAnims, "WalkNew")),
      ],
      [
        "MeleeStanding",
        this.mixer.clipAction(getAnimationByName(modelAnims, "MeleeStanding")),
      ],
      [
        "MeleeMotion",
        this.mixer.clipAction(getAnimationByName(modelAnims, "MeleeMotion")),
      ],
      [
        "MeleeMotion_2",
        this.mixer.clipAction(getAnimationByName(modelAnims, "MeleeMotion_2")),
      ],
      [
        "Walk_Lower",
        this.mixer.clipAction(getAnimationByName(modelAnims, "Walk_Lower")),
      ],
      [
        "Walk_Upper",
        this.mixer.clipAction(getAnimationByName(modelAnims, "Walk_Upper")),
      ],
      [
        "Strave_Walk_Left",
        this.mixer.clipAction(
          getAnimationByName(modelAnims, "Strave_Walk_Left")
        ),
      ],
      [
        "Strave_Walk_Right",
        this.mixer.clipAction(
          getAnimationByName(modelAnims, "Strave_Walk_Right")
        ),
      ],
    ]);

    this.mixer.addEventListener("finished", (e) => {
      if (
        e.action === this.animations.get("MeleeMotion") ||
        e.action === this.animations.get("MeleeMotion_2")
      )
        this.isAttacking = false;
    });

    this.scene.add(this.dummy);
    this.dummy.add(this.model);
    this.boundingBox = new THREE.Box3();

    // Play default animations
    this.animations.get("Idle")!.play();
    this.animations.get("Walk_Lower")!.play();
    this.animations.get("Walk_Upper")!.play();
    this.animations.get("Strave_Walk_Left")!.play();
    this.animations.get("Strave_Walk_Right")!.play();
  }

  setPosition(position: THREE.Vector3) {
    this.dummy.position.copy(position);
  }

  setQuaternion(quaternion: THREE.Quaternion) {
    this.dummy.quaternion.copy(quaternion);
  }

  setIsLocalPlayer(bool: boolean) {
    this.isLocalPlayer = bool;
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
    const { position, quaternion, color, health, coins, velocity, keys } =
      state;

    this.coins = coins;
    this.color = color;
    this.velocity.copy(velocity);
    this.health = health;
    this.dummy.position.copy(position);
    this.keys = keys;

    // Smooth rotation
    this.dummy.quaternion.slerp(
      new THREE.Quaternion(
        quaternion.x,
        quaternion.y,
        quaternion.z,
        quaternion.w
      ),
      0.15
    );

    // Initial material setup
    if (!this.hasInit) {
      this.model.traverse((item: any) => {
        if (item instanceof THREE.SkinnedMesh) {
          if (["Torso", "Arm_R", "Arm_L"].includes(item.name)) {
            item.material = new THREE.MeshStandardMaterial({ color });
          }
          if (["Leg_R", "Leg_L"].includes(item.name)) {
            item.material = new THREE.MeshStandardMaterial({
              color: pantColor,
            });
          }
          if (item.name === "Head") {
            item.material = new THREE.MeshStandardMaterial({
              color: skinColor,
            });
          }
        }
      });
      this.hasInit = true;
    }
  }

  playAnimation(name: string) {
    const anim = this.animations.get(name);
    if (!anim) return;

    if (name === "MeleeMotion" || name === "MeleeMotion_2") {
      AudioManager.instance.playAudio(
        getRandomFromArray(["whoosh_1", "whoosh_2", "whoosh_3"]),
        0.05
      );
      this.isAttacking = true;

      // Set exclusive weight with smooth crossfade
      const other =
        name === "MeleeMotion"
          ? this.animations.get("MeleeMotion_2")
          : this.animations.get("MeleeMotion");
      other?.crossFadeTo(anim, 0.2, false);
      anim
        .setEffectiveWeight(1)
        .play()
        .reset()
        .setLoop(THREE.LoopOnce, Infinity).clampWhenFinished = true;
      return;
    }

    anim.play().reset().setLoop(THREE.LoopRepeat, Infinity);
  }

  private interpolateWeight(
    action: THREE.AnimationAction | undefined,
    target: number,
    delta: number,
    speed: number = 10
  ) {
    if (!action) return;
    const current = action.getEffectiveWeight();
    action.setEffectiveWeight(
      THREE.MathUtils.lerp(current, target, delta * speed)
    );
  }

  private updateAnimationState(delta: number) {
    const keys = this.isLocalPlayer
      ? InputManager.instance.getState()
      : this.keys;
    const isStrafing = keys.mouseRight;
    const speedFactor = keys.shift ? 1.5 : 1;
    const moving = this.velocity.length() > 0.01;

    const idle = this.animations.get("Idle");
    const walkLower = this.animations.get("Walk_Lower");
    const walkUpper = this.animations.get("Walk_Upper");
    const strafeLeft = this.animations.get("Strave_Walk_Left");
    const strafeRight = this.animations.get("Strave_Walk_Right");

    if (this.isAttacking) {
      this.interpolateWeight(idle, 0, delta);
      this.interpolateWeight(walkUpper, 0, delta);
    }

    if (moving) {
      if (!this.isAttacking)
        this.interpolateWeight(walkUpper, 1, delta * speedFactor);

      if (isStrafing) {
        this.interpolateWeight(walkLower, 0, delta);
        if (keys.a) {
          this.interpolateWeight(strafeLeft, 1, delta * speedFactor);
          this.interpolateWeight(strafeRight, 0, delta);
        } else if (keys.d) {
          this.interpolateWeight(strafeRight, 1, delta * speedFactor);
          this.interpolateWeight(strafeLeft, 0, delta);
        } else {
          this.interpolateWeight(walkLower, 1, delta * speedFactor);
          this.interpolateWeight(strafeLeft, 0, delta);
          this.interpolateWeight(strafeRight, 0, delta);
        }
      } else {
        this.interpolateWeight(walkLower, 1, delta * speedFactor);
        this.interpolateWeight(strafeLeft, 0, delta);
        this.interpolateWeight(strafeRight, 0, delta);
      }

      this.interpolateWeight(idle, 0, delta);
    } else {
      this.interpolateWeight(idle, this.isAttacking ? 0 : 1, delta);
      this.interpolateWeight(walkUpper, 0, delta);
      this.interpolateWeight(walkLower, 0, delta);
      this.interpolateWeight(strafeLeft, 0, delta);
      this.interpolateWeight(strafeRight, 0, delta);
    }
  }

  updateAudio() {
    // Implement audio triggers here if needed
  }

  update(delta: number) {
    this.updateAnimationState(delta);
    this.updateAudio();
    this.mixer.update(delta);
  }
}

export default ClientPlayer;
