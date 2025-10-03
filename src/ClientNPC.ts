import * as THREE from "three";
import { getAnimationByName, getRandomFromArray } from "./utils";
import { AssetsManager } from "./AssetsManager";
import AudioManager from "./AudioManager";
import InputManager from "./InputManager";
import FloatingText from "./FloatingText";
import ClientPhysics, { PhysicsObject } from "./ClientPhysics";
import { randFloat } from "three/src/math/MathUtils";
import { Hand, handOffset } from "./ClientPlayer";
import ClientWeapon from "./ClientWeapon";

const skinColor = 0xffe9c4;
const pantColor = 0x4756c9;

type StateData = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  velocity: THREE.Vector3;
  color: string;
  health: string;
  leftHand: {
    side: "left" | "right";
    item?: {
      name: string;
      ammo: number;
      capacity: number;
      isReloading: boolean;
    };
  };
  rightHand: {
    side: "left" | "right";
    item?: {
      name: string;
      ammo: number;
      capacity: number;
      isReloading: boolean;
    };
  };
  viewQuaternion: THREE.Quaternion;
  keys: any;

  //health: number;
  //coins: number;
  // keys: any;
  //isSitting: boolean;
  //   controlledObject: { id: string } | null;
};

type RagdollPair = {
  mesh: THREE.Mesh;
  physics: PhysicsObject;
};

class ClientNPC {
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
  private isLocalPlayer: boolean = false;

  public isSitting: boolean = false;

  private infoSprite: FloatingText | null = null;

  public controlledObject: { id: string } | null = null;

  private bones: Map<string, any> = new Map();
  private skinnedMeshes: Map<string, any> = new Map();

  private hasDied: boolean = false;

  private ragdollPairs: RagdollPair[] = [];

  private ragdollReady: boolean = false;

  private passDone: boolean = false;

  public leftHand: Hand;
  public rightHand: Hand;

  private viewQuaternion: THREE.Quaternion | null = null; // add this near top (like ClientPlayer)

  constructor(
    networkId: string,
    color: string,
    scene: THREE.Scene,
    isLocalPlayer: boolean = false
  ) {
    this.networkId = networkId;
    this.color = color;
    this.scene = scene;
    this.isLocalPlayer = isLocalPlayer;

    const modelScene = AssetsManager.instance.getBoxmanClone()?.scene;
    const modelAnims = AssetsManager.instance.getBoxmanClone()
      ?.animations as THREE.AnimationClip[];

    const modelOffsetY = -0.9;

    this.model = modelScene;
    this.model.position.y = modelOffsetY;
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
      [
        "Aim_Upper",
        this.mixer.clipAction(getAnimationByName(modelAnims, "Aim_Upper")),
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

    this.dummy.visible = false;

    this.scene.add(this.dummy);
    this.dummy.add(this.model);
    this.boundingBox = new THREE.Box3();

    // bones stuff
    this.model.traverse((obj: any) => {
      if (obj instanceof THREE.Bone) {
        this.bones.set(obj.name, obj);
      }
    });

    this.leftHand = { side: "left", bone: this.bones.get("Bone006") } as Hand;
    this.rightHand = {
      side: "right",
      bone: this.bones.get("Bone003"),
    } as Hand;

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
      this.infoSprite = new FloatingText(`[NPC] ${this.networkId.slice(0, 4)}`);

      this.infoSprite.setPositionAbove(this.dummy, 1.5);
    }
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

  prepareRagdoll() {
    if (this.ragdollReady) return;

    // Map mesh names → controlling bone names
    const boneMap: Record<string, string> = {
      Head: "Bone007",
      Torso: "Bone",
      Arm_L: "Bone005",
      Arm_R: "Bone002",
      Leg_L: "Bone013",
      Leg_R: "Bone009",
    };

    // per-part offsets to fine-tune ragdoll spawn positions
    const offsetMap: Record<string, THREE.Vector3> = {
      Head: new THREE.Vector3(0, 0.4, 0), // raise head a bit
      Torso: new THREE.Vector3(0, 0, 0), // no offset
      Arm_L: new THREE.Vector3(-0.05, 0, 0), // left arm tweak
      Arm_R: new THREE.Vector3(0.05, 0, 0), // right arm tweak
      Leg_L: new THREE.Vector3(-0.05, -0.3, 0), // adjust leg pivot
      Leg_R: new THREE.Vector3(0.05, -0.3, 0),
    };

    this.skinnedMeshes.forEach((skin: THREE.SkinnedMesh) => {
      // 1. Find controlling bone for this part
      const boneName = boneMap[skin.name];
      const bone = this.bones.get(boneName);

      if (!bone) {
        console.warn(`No bone found for ${skin.name}`);
        return;
      }

      // 2. Get bone's world transform
      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();
      bone.getWorldPosition(worldPos);
      bone.getWorldQuaternion(worldQuat);

      // apply custom offset in bone space
      const localOffset = offsetMap[skin.name] || new THREE.Vector3();
      const offsetWorld = localOffset.clone();
      worldPos.add(offsetWorld);

      // 3. Clone geometry & center its pivot so it rotates correctly
      const geometry = skin.geometry.clone();
      geometry.computeBoundingBox();
      const center = new THREE.Vector3();
      geometry.boundingBox!.getCenter(center);
      geometry.translate(-center.x, -center.y, -center.z);

      // 4. Spawn rigidbody at bone position/rotation
      const physics = ClientPhysics.instance.createDynamicBox(
        worldPos.clone(),
        new THREE.Vector3(0.1, 0.1, 0.1)
      );

      const forceStrength = randFloat(0.01, 0.02);
      const randomDir = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2, // upward bias
        Math.random() * 2 - 1
      ).normalize();

      const impulse = {
        x: randomDir.x * forceStrength,
        y: randomDir.y * forceStrength,
        z: randomDir.z * forceStrength,
      };

      physics.rigidBody.applyImpulse(impulse, true);

      // 5. Create visual mesh at same position
      const mesh = new THREE.Mesh(geometry, skin.material);
      mesh.position.copy(worldPos);

      const skinQuat = new THREE.Quaternion();
      skin.getWorldQuaternion(skinQuat);

      mesh.quaternion.copy(skinQuat);
      this.scene.add(mesh);

      // 6. Store pair for update loop
      this.ragdollPairs.push({ mesh, physics });
    });

    // Hide original model so only ragdoll parts are visible
    this.dummy.visible = false;
    this.ragdollReady = true;
  }

  cleanup() {
    this.ragdollPairs.forEach((pair) => {
      this.scene.remove(pair.mesh);
      ClientPhysics.instance.remove(pair.physics);
    });

    if (this.leftHand.item) this.scene.remove(this.leftHand.item.object);
    if (this.rightHand.item) this.scene.remove(this.rightHand.item.object);

    this.ragdollPairs = [];
  }

  handleHandItem(
    side: "left" | "right",
    item: { name: string; ammo: number; capacity: number; isReloading: boolean }
  ) {
    const hand = side == "left" ? this.leftHand : (this.rightHand as Hand);

    if (item.name == "pistol") {
      if (hand.item && hand.item.name == item.name) {
        // update existing state

        const weapon = hand.item as ClientWeapon;

        weapon.ammo = item.ammo;
        weapon.capacity = item.capacity;
        weapon.isReloading = item.isReloading;

        if (weapon.isReloading) weapon.reload();
      } else {
        // create new
        const mesh = AssetsManager.instance.models.get("pistol")!.scene.clone();
        this.scene.add(mesh);

        const weapon = new ClientWeapon("pistol", mesh);

        hand.item = weapon;
      }
    }
  }

  setState(state: StateData) {
    const {
      position,
      quaternion,
      color,
      health,
      //   coins,
      velocity,
      keys,
      //   isSitting,
      //   controlledObject,
      leftHand,
      rightHand,
      viewQuaternion,
    } = state;

    // this.coins = coins;
    this.health = parseInt(health);
    this.color = color;
    this.velocity.copy(velocity);
    // this.health = health;
    this.dummy.position.copy(position);

    this.viewQuaternion = viewQuaternion;

    this.keys = keys;

    // this.isSitting = isSitting;

    // this.controlledObject = controlledObject;

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

    if (leftHand) {
      const { side, item } = leftHand;

      if (side && item) {
        this.handleHandItem(side, item);
      }
    }

    if (rightHand) {
      const { side, item } = rightHand;

      if (side && item) {
        this.handleHandItem(side, item);
      }
    }

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

          this.skinnedMeshes.set(item.name, item);
        }
      });
      this.hasInit = true;
      this.dummy.visible = true;
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
    const input = this.isLocalPlayer
      ? InputManager.instance.getState()
      : this.keys;
    const isStrafing = input.aim;
    let speedFactor = input.sprint ? 1.5 : 1;
    if (isStrafing) speedFactor = 1;

    const horizontalVelocity = new THREE.Vector3(
      this.velocity.x,
      0,
      this.velocity.z
    );
    const moving = horizontalVelocity.length() > 0.01;
    const isRunning = input.sprint && moving && !isStrafing;

    const idle = this.animations.get("Idle");
    const walkLower = this.animations.get("Walk_Lower");
    const walkUpper = this.animations.get("Walk_Upper");
    const strafeLeft = this.animations.get("Strave_Walk_Left");
    const strafeRight = this.animations.get("Strave_Walk_Right");
    const sit = this.animations.get("Sit");
    const run = this.animations.get("Running");
    const runningUpper = this.animations.get("Running_Upper");
    const runningLower = this.animations.get("Running_Lower");
    const aimUpper = this.animations.get("Aim_Upper");

    // --- AIM LOGIC ---
    const aiming = input.aim;
    if (aiming && this.rightHand.item) {
      this.interpolateWeight(aimUpper, 1, delta);
      this.interpolateWeight(idle, 0, delta);
      this.interpolateWeight(walkUpper, 0, delta);
      this.interpolateWeight(walkLower, 0, delta);
      this.interpolateWeight(strafeLeft, 0, delta);
      this.interpolateWeight(strafeRight, 0, delta);
      this.interpolateWeight(run, 0, delta);
      this.interpolateWeight(runningUpper, 0, delta);
      this.interpolateWeight(runningLower, 0, delta);

      if (moving) {
        if (input.moveLeft) {
          this.interpolateWeight(strafeLeft, 1, delta * speedFactor);
          this.interpolateWeight(strafeRight, 0, delta);
        } else if (input.moveRight) {
          this.interpolateWeight(strafeRight, 1, delta * speedFactor);
          this.interpolateWeight(strafeLeft, 0, delta);
        } else {
          this.interpolateWeight(walkLower, 1, delta * speedFactor);
          this.interpolateWeight(strafeLeft, 0, delta);
          this.interpolateWeight(strafeRight, 0, delta);
        }
      }

      const rootBone = this.bones.get("Bone") as THREE.Bone;
      if (rootBone) {
        // pick source quaternion: local cam or remote view
        const sourceQuat = this.viewQuaternion ?? new THREE.Quaternion();

        const forwardWorld = new THREE.Vector3(0, 0, -1).applyQuaternion(
          sourceQuat
        );

        // convert to local player space
        const forwardLocal = forwardWorld.clone();
        this.dummy.worldToLocal(forwardLocal.add(this.dummy.position));

        const pitch = Math.atan2(
          forwardLocal.y,
          Math.sqrt(
            forwardLocal.x * forwardLocal.x + forwardLocal.z * forwardLocal.z
          )
        );
        let yaw = -Math.atan2(forwardLocal.x, -forwardLocal.z);

        const maxTwist = Math.PI / 2.5;
        yaw = Math.max(-maxTwist, Math.min(maxTwist, yaw));

        rootBone.rotation.z = pitch;
        rootBone.rotation.y = yaw;
      }

      return;
    }

    if (this.isSitting) {
      this.interpolateWeight(sit, 1, delta);
      this.interpolateWeight(idle, 0, delta);
      this.interpolateWeight(walkUpper, 0, delta);
      this.interpolateWeight(walkLower, 0, delta);
      this.interpolateWeight(strafeLeft, 0, delta);
      this.interpolateWeight(strafeRight, 0, delta);
      this.interpolateWeight(runningLower, 0, delta);
      this.interpolateWeight(runningUpper, 0, delta);
      this.interpolateWeight(aimUpper, 0, delta);
      return;
    } else {
      this.interpolateWeight(sit, 0, delta);
    }

    if (this.isAttacking) {
      this.interpolateWeight(idle, 0, delta);
      this.interpolateWeight(walkUpper, 0, delta);
      this.interpolateWeight(runningUpper, 0, delta);
      this.interpolateWeight(aimUpper, 0, delta);
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
      this.interpolateWeight(aimUpper, 0, delta);
    } else if (moving) {
      this.interpolateWeight(runningUpper, 0, delta);
      this.interpolateWeight(runningLower, 0, delta);

      if (!this.isAttacking)
        this.interpolateWeight(walkUpper, 1, delta * speedFactor);

      if (isStrafing) {
        this.interpolateWeight(walkLower, 0, delta);
        if (input.moveLeft) {
          this.interpolateWeight(strafeLeft, 1, delta * speedFactor);
          this.interpolateWeight(strafeRight, 0, delta);
        } else if (input.moveRight) {
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
        this.interpolateWeight(aimUpper, 0, delta);
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
      this.interpolateWeight(aimUpper, 0, delta);
    }
  }

  updateAudio() {
    // Implement audio triggers here if needed

    console.log(this.keys, "keysss");

    if (this.keys["shoot"]) {
      const wp = this.rightHand.item as ClientWeapon;
      wp.use();
    }
  }

  updateHands() {
    if (!this.leftHand?.bone || !this.rightHand?.bone) return;
    if (!this.leftHand.item && !this.rightHand.item) return;

    const applyHandTransform = (hand: any) => {
      if (!hand.item) return;

      const worldPos = new THREE.Vector3();
      const worldQuat = new THREE.Quaternion();

      // Get bone world transform
      hand.bone.getWorldPosition(worldPos);
      hand.bone.getWorldQuaternion(worldQuat);

      // Position = bone position + offset
      hand.item.object.position.copy(
        worldPos.add(handOffset.clone().applyQuaternion(worldQuat))
      );

      // Orientation = bone orientation * extra rotation
      const extraRot = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, -1),
        Math.PI / 2
      );
      hand.item.object.quaternion.copy(worldQuat).multiply(extraRot);
    };

    applyHandTransform(this.leftHand);
    applyHandTransform(this.rightHand);
  }

  update(delta: number) {
    if (this.ragdollReady) {
      this.ragdollPairs.forEach((pair, index) => {
        const rbPos = pair.physics.rigidBody.translation();
        const rbRot = pair.physics.rigidBody.rotation();

        pair.mesh.position.copy(rbPos);
        pair.mesh.quaternion.copy(rbRot);
      });
    }

    if (this.health <= 0) {
      if (!this.hasDied) {
        this.prepareRagdoll();
        this.hasDied = true;
      }

      return;
    }

    // if (this.health == 100 && this.hasDied) {
    //   this.hasDied = false;
    //   this.ragdollPairs = [];
    // }

    if (!this.hasDied) {
      this.updateAnimationState(delta);
      this.updateHands();

      this.updateAudio();
      this.mixer.update(delta);
    }

    // if (!this.isLocalPlayer && this.infoSprite) {
    //   // let color = "#ffffff";
    //   // if (this.health <= 25) {
    //   //   color = "#ff0000";
    //   // }
    //   this.infoSprite.setText(`${this.networkId.slice(0, 4)}`);
    // }
  }
}

export default ClientNPC;
