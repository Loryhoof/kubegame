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

    //this.animations.get("WalkNew")?.play();

    // this.animations.get("Melee")?.setEffectiveWeight

    // this.mixer.addEventListener("loop", (e) => {
    //   console.log(e.action);
    //   if (e.action == this.animations.get("MeleeMotion"))
    //     this.isAttacking = true;
    // });

    this.mixer.addEventListener("finished", (e) => {
      if (e.action === this.animations.get("MeleeMotion"))
        this.isAttacking = false;

      if (e.action === this.animations.get("MeleeMotion_2"))
        this.isAttacking = false;
    });

    // Add to scene
    this.scene.add(this.dummy);
    this.dummy.add(this.model);

    this.boundingBox = new THREE.Box3();

    // Play default
    //this.playExclusiveAnimation("Idle");
    //this.playExclusiveAnimation("Walk_Lower");
    this.animations.get("Idle")?.play();
    this.animations.get("Walk_Lower")!.play();
    this.animations.get("Walk_Upper")!.play();

    this.animations.get("Strave_Walk_Left")!.play();
    this.animations.get("Strave_Walk_Right")!.play();
  }

  // --- Position/Rotation Methods ---
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

  // --- State Sync ---
  setState(state: StateData) {
    const { position, quaternion, color, health, coins, velocity, keys } =
      state;

    this.coins = coins;
    this.color = color;
    this.velocity.copy(velocity);
    this.health = health;
    this.dummy.position.copy(position);

    this.keys = keys;
    console.log(this.keys);

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

  // --- Animation Control ---
  private playExclusiveAnimation(
    name: string,
    fadeDuration: number = 0.1,
    loop: THREE.AnimationActionLoopStyles = THREE.LoopRepeat,
    reps: number = Infinity
  ) {
    if (this.currentAnimation === name) return; // Already playing

    const newAnim = this.animations.get(name);
    if (!newAnim) return;

    newAnim.reset().setLoop(loop, reps).play();

    // Crossfade from currently playing animations
    // this.animations.forEach((anim, key) => {
    //   if (key !== name && anim.isRunning()) {
    //     anim.crossFadeTo(newAnim, fadeDuration, false);
    //   }
    // });

    this.currentAnimation = name;
  }

  updateAudio() {
    const audio = AudioManager.instance;

    // if (input.isJustPressed(" ")) {
    //   audio.playAudio("huh_1", 0.05);
    // }

    // if (input.isJustPressed("e")) audio.playAudio("pickup");

    // if (input.isJustPressed())
  }

  playAnimation(name: string) {
    const anim = this.animations.get(name);

    if (!anim) return;

    if (anim == this.animations.get("MeleeMotion")) {
      //AudioManager.instance.playAudio("huh_1", 0.05);
      AudioManager.instance.playAudio(
        getRandomFromArray(["whoosh_1", "whoosh_2", "whoosh_3"]),
        0.05
      );
      this.isAttacking = true;

      this.animations.get("MeleeMotion")?.setEffectiveWeight(1);
      this.animations.get("MeleeMotion_2")?.setEffectiveWeight(0);

      if (this.animations.get("MeleeMotion_2")?.isRunning()) {
        this.animations.get("MeleeMotion_2")?.crossFadeTo(anim, 0.2);
      }
    }

    if (anim == this.animations.get("MeleeMotion_2")) {
      //AudioManager.instance.playAudio("huh_1", 0.05);
      AudioManager.instance.playAudio(
        getRandomFromArray(["whoosh_1", "whoosh_2", "whoosh_3"]),
        0.05
      );
      this.isAttacking = true;
      this.animations.get("MeleeMotion_2")?.setEffectiveWeight(1);
      this.animations.get("MeleeMotion")?.setEffectiveWeight(0);

      if (this.animations.get("MeleeMotion")?.isRunning()) {
        this.animations.get("MeleeMotion")?.crossFadeTo(anim, 0.2);
      }
    }

    anim.play().reset().setLoop(THREE.LoopOnce, Infinity);
    anim.clampWhenFinished = true;
  }

  private updateAnimationState() {
    const keys = this.isLocalPlayer
      ? InputManager.instance.getState()
      : this.keys;

    const straving = keys.mouseRight;

    const velMag = this.velocity.length();

    const walkLower = this.animations.get("Walk_Lower");
    const walkUpper = this.animations.get("Walk_Upper");
    const meleeMotion = this.animations.get("MeleeMotion");

    const straveWalkLeft = this.animations.get("Strave_Walk_Left");
    const straveWalkRight = this.animations.get("Strave_Walk_Right");

    const idle = this.animations.get("Idle");

    const speedFactor = keys.shift ? 1.5 : 1;

    // if (keys.mouseLeft) {
    //   const animList = ["MeleeMotion", "MeleeMotion_2"];

    //   this.playAnimation(getRandomFromArray(animList));
    // }

    if (this.isAttacking) {
      idle!.setEffectiveWeight(0);
      walkUpper!.setEffectiveWeight(0);
    }

    if (velMag > 0.01) {
      if (!this.isAttacking) {
        walkUpper?.setEffectiveWeight(1).setEffectiveTimeScale(speedFactor);
      }

      if (straving) {
        walkLower?.setEffectiveWeight(0);
        if (keys.a) {
          straveWalkRight?.setEffectiveWeight(0);
          straveWalkLeft
            ?.setEffectiveWeight(1)
            .setEffectiveTimeScale(speedFactor);
        } else if (keys.d) {
          straveWalkLeft?.setEffectiveWeight(0);
          straveWalkRight
            ?.setEffectiveWeight(1)
            .setEffectiveTimeScale(speedFactor);
        } else {
          straveWalkLeft?.setEffectiveWeight(0);
          straveWalkRight?.setEffectiveWeight(0);
          walkLower?.setEffectiveWeight(1).setEffectiveWeight(speedFactor);
        }
      } else {
        idle?.setEffectiveWeight(0);
        straveWalkLeft?.setEffectiveWeight(0);
        straveWalkRight?.setEffectiveWeight(0);
        walkLower?.setEffectiveWeight(1).setEffectiveTimeScale(speedFactor);
      }
    } else {
      walkLower?.setEffectiveWeight(0);
      walkUpper?.setEffectiveWeight(0);
      straveWalkLeft?.setEffectiveWeight(0);
      straveWalkRight?.setEffectiveWeight(0);
      if (!this.isAttacking) {
        idle?.setEffectiveWeight(1);
      }
    }
  }

  update(delta: number) {
    this.updateAnimationState();
    this.updateAudio();
    this.mixer.update(delta);
  }
}

export default ClientPlayer;
