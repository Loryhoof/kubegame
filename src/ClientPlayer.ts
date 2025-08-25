import * as THREE from "three";
import { getAnimationByName, getRandomFromArray } from "./utils";
import { AssetsManager } from "./AssetsManager";
import AudioManager from "./AudioManager";
import InputManager from "./InputManager";
import FloatingText from "./FloatingText";
import CameraManager from "./CameraManager";
import World from "./World";
import { PLAYER_MASS } from "./constants";

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
  isSitting: boolean;
  controlledObject: { id: string } | null;
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
  public dummy: THREE.Object3D = new THREE.Object3D();
  private hasInit: boolean = false;
  private keys: Record<string, boolean> = {};

  public boundingBox: THREE.Box3;
  public readonly animations: Map<string, THREE.AnimationAction>;
  public wantsToAttack: boolean = false;
  public isAttacking: boolean = false;
  private currentAnimation: string | null = null;
  public isLocalPlayer: boolean = false;

  public isSitting: boolean = false;

  private infoSprite: FloatingText | null = null;

  public controlledObject: { id: string } | null = null;

  private raycaster: THREE.Raycaster = new THREE.Raycaster();

  private world: World;

  constructor(
    world: World,
    networkId: string,
    color: string,
    scene: THREE.Scene,
    isLocalPlayer: boolean = false
  ) {
    this.world = world;
    this.networkId = networkId;
    this.color = color;
    this.scene = scene;
    this.isLocalPlayer = isLocalPlayer;

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
      ["Sit", this.mixer.clipAction(getAnimationByName(modelAnims, "Sit"))],
      // [
      //   "Running",
      //   this.mixer.clipAction(getAnimationByName(modelAnims, "Running")),
      // ],
      [
        "Running_Upper",
        this.mixer.clipAction(getAnimationByName(modelAnims, "Running_Upper")),
      ],
      [
        "Running_Lower",
        this.mixer.clipAction(getAnimationByName(modelAnims, "Running_Lower")),
      ],
    ]);

    this.mixer.addEventListener("finished", (e) => {
      if (
        e.action === this.animations.get("MeleeMotion") ||
        e.action === this.animations.get("MeleeMotion_2")
      ) {
        e.action.crossFadeTo(this.animations.get("Idle")!, 0.2);
        this.isAttacking = false;
      }
    });

    this.scene.add(this.dummy);
    this.dummy.add(this.model);
    this.boundingBox = new THREE.Box3();

    // // Play default animations
    // this.animations.get("Idle")!.play();
    // this.animations.get("Walk_Lower")!.play();
    // this.animations.get("Walk_Upper")!.play();
    // this.animations.get("Strave_Walk_Left")!.play();
    // this.animations.get("Strave_Walk_Right")!.play();

    this.animations.forEach((anim, name) => {
      anim.play();
      anim.setEffectiveWeight(name === "Idle" ? 1 : 0);
      anim.setLoop(THREE.LoopRepeat, Infinity);
    });

    if (!this.isLocalPlayer) {
      this.infoSprite = new FloatingText(this.networkId.slice(0, 4));

      this.infoSprite.setPositionAbove(this.dummy, 1.5);
    }
  }

  setPosition(position: THREE.Vector3) {
    this.dummy.position.copy(position);
  }

  lerpPosition(position: THREE.Vector3, t: number) {
    this.dummy.position.lerp(position, t);
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

  slerpQuaternion(quat: THREE.Quaternion, t: number) {
    this.dummy.quaternion.slerp(quat, t);
  }

  getQuaternion() {
    return this.dummy.quaternion;
  }

  remove() {
    this.scene.remove(this.dummy);
  }

  rayDown(): THREE.Vector3 | null {
    const DOWN = new THREE.Vector3(0, -1, 0);
    this.raycaster.set(this.dummy.position, DOWN);

    const intersects = this.raycaster.intersectObjects(
      this.world.entities.map((item) => item.mesh)
    );

    if (intersects.length > 0) {
      return intersects[0].point;
    }
    return null;
  }

  collidingForward(): boolean {
    const FORWARD = new THREE.Vector3(0, 0, -1);
    this.raycaster.set(
      this.dummy.position,
      FORWARD.applyQuaternion(this.dummy.quaternion)
    );

    const intersects = this.raycaster.intersectObjects(
      this.world.entities.map((item) => item.mesh)
    );

    if (intersects.length > 0) {
      if (intersects[0].distance <= 0.5) {
        return true;
      }
    }

    return false;
  }

  predictMovement(delta: number, keys?: any, quat?: THREE.Quaternion) {
    if (!this.isLocalPlayer) return;

    const input = keys || InputManager.instance.getState();
    const inputDir = new THREE.Vector3();

    const GRAVITY = -9.81;
    const JUMP_IMPULSE = 0.8; // backend impulse
    const JUMP_FORCE = JUMP_IMPULSE / PLAYER_MASS;
    const BASE_SPEED = 4;
    const WALK_SPEED = BASE_SPEED;
    const RUN_SPEED = BASE_SPEED * 2;
    const MAX_WALL_DISTANCE = 0.3;

    // ---- INPUT VECTOR ----
    inputDir.set(0, 0, 0);
    if (input.w) inputDir.z -= 1;
    if (input.s) inputDir.z += 1;
    if (input.a) inputDir.x -= 1;
    if (input.d) inputDir.x += 1;

    const hasInput = inputDir.lengthSq() > 0;

    let worldDir = new THREE.Vector3();
    if (hasInput) {
      inputDir.normalize();

      const camQuat = quat || CameraManager.instance.getCamera().quaternion;
      const euler = new THREE.Euler(0, 0, 0, "YXZ");
      euler.setFromQuaternion(camQuat);

      const yawQuat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        euler.y
      );

      worldDir = inputDir.applyQuaternion(yawQuat);
    }

    // ---- HORIZONTAL VELOCITY ----
    const speed = input.shift ? RUN_SPEED : WALK_SPEED;
    const targetVel = hasInput
      ? worldDir.multiplyScalar(speed)
      : new THREE.Vector3(0, 0, 0);

    const ACCEL = 25;
    this.velocity.x = THREE.MathUtils.lerp(
      this.velocity.x,
      targetVel.x,
      Math.min(1, ACCEL * delta)
    );
    this.velocity.z = THREE.MathUtils.lerp(
      this.velocity.z,
      targetVel.z,
      Math.min(1, ACCEL * delta)
    );

    // ---- GRAVITY ----
    this.velocity.y += GRAVITY * delta;

    // ---- GROUND CHECK ----
    const groundPoint = this.rayDown();
    let isGrounded = false;

    if (groundPoint) {
      const dist = groundPoint.distanceTo(this.dummy.position);

      // hard snap if close enough to the ground
      if (dist <= 0.5 && this.velocity.y <= 0) {
        this.dummy.position.y = groundPoint.y + 0.5;
        this.velocity.y = 0;
        isGrounded = true;
      }
    }

    // ---- JUMP ----
    if (input[" "] && isGrounded) {
      this.velocity.y = JUMP_FORCE;
      isGrounded = false;
    }

    // ---- WALL COLLISION ----
    if (this.velocity.lengthSq() > 0.0001) {
      this.raycaster.set(
        this.dummy.position,
        this.velocity.clone().normalize()
      );
      const intersects = this.raycaster.intersectObjects(
        this.world.entities.map((item) => item.mesh),
        true
      );

      if (
        intersects.length > 0 &&
        intersects[0].distance <= MAX_WALL_DISTANCE
      ) {
        this.velocity.x = 0;
        this.velocity.z = 0;
      }
    }

    // ---- APPLY MOVEMENT ----
    this.dummy.position.addScaledVector(this.velocity, delta);

    // ---- ROTATE PLAYER ----
    const horizontalVelocity = new THREE.Vector3(
      this.velocity.x,
      0,
      this.velocity.z
    );

    if (horizontalVelocity.lengthSq() > 0.0001) {
      if (input.mouseRight) {
        const camQuat = quat || CameraManager.instance.getCamera().quaternion;
        const euler = new THREE.Euler().setFromQuaternion(camQuat, "YXZ");

        const yawQuat = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          euler.y
        );

        this.dummy.quaternion.slerp(yawQuat, 0.25);
      } else {
        const yaw = Math.atan2(-this.velocity.x, -this.velocity.z);
        const targetQuat = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          yaw
        );
        this.dummy.quaternion.slerp(targetQuat, 0.25);
      }
    }
  }

  createFloatingText(): THREE.Sprite {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;

    canvas.width = 256;
    canvas.height = 64;

    context.font = "Bold 40px Arial";
    context.fillStyle = "#ffffff";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("Player", canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    });

    const sprite = new THREE.Sprite(material);

    sprite.scale.set(2, 0.5, 1);

    return sprite;
  }

  // setInterpolatedState(
  //   state: StateData
  // ) {

  //   const {
  //     position,
  //     quaternion,
  //     color,
  //     health,
  //     coins,
  //     velocity,
  //     keys,
  //     isSitting,
  //     controlledObject,
  //   } = state;
  //   //console.log(position, quaternion);

  //   //return;
  //   this.velocity.copy(velocity);
  //   this.dummy.position.copy(position);
  //   this.dummy.quaternion.slerp(quaternion, 0.15);

  //   // Initial material setup
  //   if (!this.hasInit) {
  //     this.model.traverse((item: any) => {
  //       if (item instanceof THREE.SkinnedMesh) {
  //         if (["Torso", "Arm_R", "Arm_L"].includes(item.name)) {
  //           item.material = new THREE.MeshStandardMaterial({
  //             color: 0xffffff * Math.random(),
  //           });
  //         }
  //         if (["Leg_R", "Leg_L"].includes(item.name)) {
  //           item.material = new THREE.MeshStandardMaterial({
  //             color: pantColor,
  //           });
  //         }
  //         if (item.name === "Head") {
  //           item.material = new THREE.MeshStandardMaterial({
  //             color: skinColor,
  //           });
  //         }
  //       }
  //     });
  //     this.hasInit = true;
  //   }
  // }

  setState(state: StateData) {
    const {
      position,
      quaternion,
      color,
      health,
      coins,
      velocity,
      keys,
      isSitting,
      controlledObject,
    } = state;

    this.coins = coins;
    this.color = color;
    this.velocity.copy(velocity);
    this.health = health;
    this.dummy.position.copy(position);
    this.keys = keys;
    this.isSitting = isSitting;

    this.controlledObject = controlledObject;

    // Smooth rotation
    this.dummy.quaternion.slerp(
      new THREE.Quaternion(
        quaternion.x,
        quaternion.y,
        quaternion.z,
        quaternion.w
      ),
      0.25
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
      other?.crossFadeTo(anim, 0, false);
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

    const horizontalVelocity = new THREE.Vector3(
      this.velocity.x,
      0,
      this.velocity.z
    );
    const moving = horizontalVelocity.length() > 0.01;
    const isRunning = keys.shift && moving;

    const idle = this.animations.get("Idle");
    const walkLower = this.animations.get("Walk_Lower");
    const walkUpper = this.animations.get("Walk_Upper");
    const strafeLeft = this.animations.get("Strave_Walk_Left");
    const strafeRight = this.animations.get("Strave_Walk_Right");
    const sit = this.animations.get("Sit");
    const run = this.animations.get("Running");
    const runningUpper = this.animations.get("Running_Upper");
    const runningLower = this.animations.get("Running_Lower");

    if (this.isSitting) {
      this.interpolateWeight(sit, 1, delta);
      this.interpolateWeight(idle, 0, delta);
      this.interpolateWeight(walkUpper, 0, delta);
      this.interpolateWeight(walkLower, 0, delta);
      this.interpolateWeight(strafeLeft, 0, delta);
      this.interpolateWeight(strafeRight, 0, delta);
      //this.interpolateWeight(run, 0, delta);
      this.interpolateWeight(runningLower, 0, delta);
      this.interpolateWeight(runningUpper, 0, delta);

      return;
    } else {
      this.interpolateWeight(sit, 0, delta);
    }

    if (this.isAttacking) {
      this.interpolateWeight(idle, 0, delta);
      this.interpolateWeight(walkUpper, 0, delta);
      this.interpolateWeight(runningUpper, 0, delta);
    }

    if (isRunning) {
      if (!this.isAttacking) {
        this.interpolateWeight(runningUpper, 1, delta);
      }
      this.interpolateWeight(runningLower, 1, delta);

      this.interpolateWeight(walkLower, 0, delta);
      this.interpolateWeight(walkUpper, 0, delta);
      this.interpolateWeight(strafeLeft, 0, delta);
      this.interpolateWeight(strafeRight, 0, delta);
      this.interpolateWeight(idle, 0, delta);
    } else if (moving) {
      this.interpolateWeight(runningUpper, 0, delta);
      this.interpolateWeight(runningLower, 0, delta);

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
      this.interpolateWeight(run, 0, delta);
      this.interpolateWeight(runningUpper, 0, delta);
      this.interpolateWeight(runningLower, 0, delta);
    }
  }

  updateAudio() {
    // Implement audio triggers here if needed
  }

  update(delta: number) {
    // this.predictMovement(delta);
    this.updateAnimationState(delta);
    this.updateAudio();
    this.mixer.update(delta);

    // if (!this.isLocalPlayer && this.infoSprite) {
    //   // let color = "#ffffff";
    //   // if (this.health <= 25) {
    //   //   color = "#ff0000";
    //   // }
    //   this.infoSprite.setText(`${this.networkId.slice(0, 4)}`);
    // }
  }
}

export default ClientPlayer;
