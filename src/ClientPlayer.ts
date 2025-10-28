import * as THREE from "three";
import { getAnimationByName, getRandomFromArray } from "./utils";
import { AssetsManager } from "./AssetsManager";
import AudioManager from "./AudioManager";
import InputManager from "./InputManager";
import FloatingText from "./FloatingText";
import CameraManager from "./CameraManager";
import World from "./World";
import { PLAYER_MASS } from "./constants";
import ClientPhysics, { PhysicsObject } from "./ClientPhysics";
import ClientWeapon from "./ClientWeapon";
import { IHoldable } from "./interfaces/IHoldable";
import { randFloat } from "three/src/math/MathUtils";

const skinColor = 0xffe9c4;
const pantColor = 0x4756c9;

export const handOffset = new THREE.Vector3(0, 0.2, 0);

type HoldingItem = {
  object: THREE.Object3D;
};

type RagdollPair = {
  mesh: THREE.Mesh;
  physics: PhysicsObject;
};

export type Hand = {
  side: "left" | "right";
  bone: THREE.Bone;
  item?: IHoldable;
};

export type ItemSlot = {
  item: IHoldable | undefined;
};

type StateData = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  velocity: THREE.Vector3;
  color: string;
  health: number;
  coins: number;
  ammo: number;
  keys: any;
  isSitting: boolean;
  controlledObject: { id: string } | null;
  nickname: string;
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
  camQuat: THREE.Quaternion;
  isDead: boolean;
  killCount: number;
  lobbyId: string;
  selectedItemSlot: number;
  itemSlots: ItemSlot[];
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
  public keys: Record<string, boolean> = {};

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

  public physicsObject: PhysicsObject;

  public serverPos: THREE.Vector3 | null = null;
  public serverVel: THREE.Vector3 | null = null;
  public lastServerTime: number = 0;

  // Jump control variables
  private grounded: boolean = false;
  private lastJumpTime: number = 0;
  private lastGroundedTime: number = 0;
  private jumpCooldown: number = 200; // ms between jumps
  private coyoteTime: number = 100; // ms grace period after leaving ground

  private debugCapsule: THREE.Mesh;

  // network stuff
  public nickname: string | null = null;

  private bones: Map<string, any> = new Map();

  public lastUseHandTime: number = -Infinity;

  public ammo: number = 0;

  // hands

  public leftHand: Hand;
  public rightHand: Hand;

  public lastMouseLeft: boolean = false;

  private viewQuaternion: THREE.Quaternion | null = null;

  // sounds

  public sounds: Map<string, THREE.PositionalAudio> = new Map();

  public isDead: boolean = false;

  private skinnedMeshes: Map<string, any> = new Map();

  private ragdollPairs: RagdollPair[] = [];

  private ragdollReady: boolean = false;

  public onDeathScreen: boolean = false;

  public killCount: number = 0;

  public lobbyId: string | null = null;

  public lastUnclippedCamPos: THREE.Vector3 | null = null;
  public lastLookDir: THREE.Vector3 | null = null;

  public selectedItemSlot: number = 0;
  public itemSlots: ItemSlot[] = [];

  private dummyCube: any;

  constructor(
    world: World,
    networkId: string,
    color: string,
    scene: THREE.Scene,
    isLocalPlayer: boolean = false
  ) {
    // debug stuff

    let halfHeight = 0.55; // weird s
    let radius = 0.275;

    this.debugCapsule = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius, halfHeight * 2),
      new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        opacity: 0.5,
        transparent: true,
      })
    );

    this.debugCapsule.visible = false;

    scene.add(this.debugCapsule);
    //
    this.world = world;
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

    // bones stuff
    this.model.traverse((obj: any) => {
      if (obj instanceof THREE.Bone) {
        console.log(obj.name);
        this.bones.set(obj.name, obj);
      }
    });

    this.dummy.visible = true;

    this.scene.add(this.dummy);
    this.dummy.add(this.model);
    this.boundingBox = new THREE.Box3();

    // const weapon: HoldingItem = {
    //   object: this.debugObject,
    // };

    this.leftHand = { side: "left", bone: this.bones.get("Bone006") } as Hand;
    this.rightHand = {
      side: "right",
      bone: this.bones.get("Bone003"),
    } as Hand;

    this.animations.forEach((anim, name) => {
      anim.play();
      anim.setEffectiveWeight(name === "Idle" ? 1 : 0);
      anim.setLoop(THREE.LoopRepeat, Infinity);
    });

    if (!this.isLocalPlayer) {
      this.infoSprite = new FloatingText(this.networkId.slice(0, 4));

      this.infoSprite.setPositionAbove(this.dummy, 1.5);
    }

    this.physicsObject = ClientPhysics.instance.createPlayerCapsule();

    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    scene.add(cube);
    cube.position.copy(this.model.position);
    cube.visible = false;

    this.dummyCube = cube;
  }

  // initAudio() {
  //   const audioManager = AudioManager.instance;
  //   const listener = audioManager.getListener();
  //   const buffer = audioManager.getBufferByName("pistol_shot_1");

  //   const hornSound = new THREE.PositionalAudio(listener)
  //     .setVolume(0.5)
  //     .setLoop(true);

  //   if (buffer) hornSound.setBuffer(buffer);

  //   this.sounds.set("horn", hornSound);

  //   this.dummy.add(hornSound);
  // }

  removeItem(hand: Hand) {
    console.log("Attempting to remove: ", hand.item, "in hand: ", hand.side);
    if (hand?.item?.object) {
      this.scene.remove(hand.item.object);
      console.log("Worked");
    }
    hand.item = undefined;
  }

  getKeys() {
    if (!this.isLocalPlayer) return null;

    return InputManager.instance.getState();
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
    // if (this.controlledObject) {
    //   const vehicle = this.world.getObjById(
    //     this.controlledObject?.id!,
    //     this.world.vehicles
    //   ) as ClientVehicle;
    //   if (vehicle) return vehicle.mesh.position;
    // }

    return this.dummy.position;
  }

  slerpQuaternion(quat: THREE.Quaternion, t: number) {
    this.dummy.quaternion.slerp(quat, t);
  }

  getQuaternion() {
    return this.dummy.quaternion;
  }

  remove() {
    this.cleanup();

    this.scene.remove(this.dummy);
    this.scene.remove(this.dummyCube);
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

  isGrounded(): boolean {
    return ClientPhysics.instance.grounded(this.physicsObject.rigidBody);
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

  jump() {
    const now = Date.now();
    const canJump =
      (this.grounded || now - this.lastGroundedTime <= this.coyoteTime) &&
      now - this.lastJumpTime > this.jumpCooldown;

    if (canJump) {
      this.lastJumpTime = now;
      this.physicsObject.rigidBody.applyImpulse({ x: 0, y: 1.5, z: 0 }, true);
    }
  }

  simulateMovement(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    dt: number,
    keys: any,
    camQuat: THREE.Quaternion
  ) {
    // Copy inputs so we don't modify originals
    const pos = position.clone();
    const vel = velocity.clone();

    // Movement constants (match server settings!)
    const GRAVITY = -9.81;
    const JUMP_IMPULSE = 0.8; // backend impulse
    const JUMP_FORCE = JUMP_IMPULSE / 1; // if PLAYER_MASS = 1
    const BASE_SPEED = 4;
    const WALK_SPEED = BASE_SPEED;
    const RUN_SPEED = BASE_SPEED * 2;
    const speed = keys.shift ? RUN_SPEED : WALK_SPEED;

    // ---- INPUT VECTOR ----
    const inputDir = new THREE.Vector3();
    if (keys.w) inputDir.z -= 1;
    if (keys.s) inputDir.z += 1;
    if (keys.a) inputDir.x -= 1;
    if (keys.d) inputDir.x += 1;

    const hasInput = inputDir.lengthSq() > 0;
    if (hasInput) inputDir.normalize();

    // Convert input to world space using camera yaw
    const euler = new THREE.Euler().setFromQuaternion(camQuat, "YXZ");
    const yawQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      euler.y
    );
    const worldDir = inputDir.applyQuaternion(yawQuat);

    // ---- HORIZONTAL VELOCITY ----
    const targetVel = hasInput
      ? worldDir.multiplyScalar(speed)
      : new THREE.Vector3(0, 0, 0);

    vel.x = targetVel.x;
    vel.z = targetVel.z;

    // ---- GRAVITY ----
    vel.y += GRAVITY * dt;

    // ---- POSITION INTEGRATION ----
    pos.addScaledVector(vel, dt);

    // ---- JUMP CHECK ----
    // if (keys[" "]) vel.y = JUMP_FORCE; // optional, if you want jump

    // Return the simulated result without touching the real rigidbody
    return { pos, vel };
  }

  predictMovement(
    delta: number,
    keys?: any,
    quat?: THREE.Quaternion,
    doRotate = true
  ) {
    if (!this.isLocalPlayer || this.isDead) return;

    const input = keys ?? InputManager.instance.getState();
    const inputDir = new THREE.Vector3();

    const GRAVITY = -9.81;
    const BASE_SPEED = 4;
    const WALK_SPEED = BASE_SPEED;
    const RUN_SPEED = BASE_SPEED * 2;

    let speed = input.sprint ? RUN_SPEED : WALK_SPEED;
    if (input.aim) speed = WALK_SPEED;

    // ---- INPUT VECTOR ----
    inputDir.set(0, 0, 0);
    if (input.moveForward) inputDir.z -= 1;
    if (input.moveBackward) inputDir.z += 1;
    if (input.moveLeft) inputDir.x -= 1;
    if (input.moveRight) inputDir.x += 1;

    const hasInput = inputDir.lengthSq() > 0;
    let worldDir = new THREE.Vector3();

    if (hasInput) {
      inputDir.normalize();

      const camQuat = quat || CameraManager.instance.getCamera().quaternion;
      const euler = new THREE.Euler().setFromQuaternion(camQuat, "YXZ");
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        euler.y
      );
      worldDir = inputDir.applyQuaternion(yawQuat);
    }

    if (input.jump) this.jump();

    const targetVel = hasInput
      ? worldDir.multiplyScalar(speed)
      : new THREE.Vector3(0, 0, 0);
    this.velocity.copy(targetVel);

    const rb = this.physicsObject.rigidBody;
    const current = rb.linvel();
    const desired = new THREE.Vector3(
      this.velocity.x,
      current.y,
      this.velocity.z
    );
    ClientPhysics.instance.setLinearVelocity(rb, desired);

    this.setPosition(rb.translation() as THREE.Vector3);

    // ---- ROTATION ONLY IF ALLOWED ----
    if (doRotate) {
      const horizontalVelocity = new THREE.Vector3(
        this.velocity.x,
        0,
        this.velocity.z
      );
      if (horizontalVelocity.lengthSq() > 0.0001) {
        if (input.aim) {
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

  cleanup() {
    // Remove ragdoll parts
    this.ragdollPairs.forEach((pair) => {
      this.scene.remove(pair.mesh);
      ClientPhysics.instance.remove(pair.physics);
    });
    this.ragdollPairs = [];
    this.ragdollReady = false;

    this.removeItem(this.leftHand);
    this.removeItem(this.rightHand);

    // Hide old model after ragdoll
    this.dummy.visible = false;
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

  respawn() {
    this.health = 100;
    this.isDead = false;
    this.onDeathScreen = false;
    this.cleanup();

    this.dummy.visible = true;
    this.handleSelectedItemChange(this.selectedItemSlot);
  }

  setRemoteState(state: StateData) {
    const {
      position,
      quaternion,
      color,
      health,
      coins,
      ammo,
      velocity,
      keys,
      isSitting,
      controlledObject,
      nickname,
      leftHand,
      rightHand,
      camQuat,
      isDead,
      killCount,
      selectedItemSlot,
      itemSlots,
    } = state;

    console.log("SET REMOTE STATE");

    this.viewQuaternion = camQuat;

    // this.coins = coins;
    this.color = color;
    this.velocity.copy(velocity);
    // this.health = health;
    this.isDead = isDead;
    this.dummy.position.copy(position);
    // this.keys = keys;
    this.isSitting = isSitting;

    this.keys = keys;

    this.controlledObject = controlledObject;
    this.nickname = nickname;
    this.ammo = ammo;
    this.killCount = killCount;

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

    // if (leftHand) {
    //   const { side, item } = leftHand;

    //   if (side && item) {
    //     this.handleHandItem(side, item);
    //   }
    // }

    // if (rightHand) {
    //   const { side, item } = rightHand;

    //   if (side && item) {
    //     this.handleHandItem(side, item);
    //   }
    // }

    // this.itemSlots = itemSlots;

    // Initial material setup
    if (!this.hasInit) {
      // this.handleSelectedItemChange(selectedItemSlot);

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

        this.skinnedMeshes.set(item.name, item);
      });
      this.hasInit = true;
      this.dummy.visible = true;
    }

    // if (this.selectedItemSlot != selectedItemSlot) {
    //   this.handleSelectedItemChange(selectedItemSlot);
    // }
  }

  getHandItem(): IHoldable | undefined {
    return this.rightHand.item;
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
      }
    }
  }

  setInitState(state: any) {
    const {
      health,
      coins,
      selectedItemSlot,
      itemSlots,
      leftHand,
      rightHand,
      ammo,
      killCount,
      deathCount,
      isDead,
    } = state;

    this.health = health;
    this.coins = coins;
    this.selectedItemSlot = selectedItemSlot;
    this.itemSlots = itemSlots;

    this.ammo = ammo;
    this.killCount = killCount;

    this.isDead = isDead;

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

    this.handleSelectedItemChange(this.selectedItemSlot);
  }

  setState(state: StateData) {
    const {
      position,
      quaternion,
      color,
      health,
      coins,
      ammo,
      velocity,
      keys,
      isSitting,
      controlledObject,
      nickname,
      leftHand,
      rightHand,
      camQuat,
      isDead,
      killCount,
      lobbyId,
      selectedItemSlot,
      itemSlots,
    } = state;

    this.lobbyId = lobbyId;

    this.viewQuaternion = camQuat;

    // // this.coins = coins;
    // this.color = color;
    // // this.velocity.copy(velocity);
    // // this.health = health;
    // this.isDead = isDead;
    // // this.dummy.position.copy(position);
    // // this.keys = keys;
    // this.isSitting = isSitting;

    // this.controlledObject = controlledObject;
    // NetworkManager.instance.showUI = !this.isDead;

    // this.nickname = nickname;
    // this.ammo = ammo;

    // this.killCount = killCount;

    // if (leftHand) {
    //   const { side, item } = leftHand;

    //   if (side && item) {
    //     this.handleHandItem(side, item);
    //   }
    // }

    // if (rightHand) {
    //   const { side, item } = rightHand;

    //   if (side && item) {
    //     this.handleHandItem(side, item);
    //   }
    // }

    // this.itemSlots = itemSlots;

    // Initial material setup
    if (!this.hasInit) {
      this.model.traverse((item: any) => {
        // this.handleSelectedItemChange(selectedItemSlot);

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

        this.skinnedMeshes.set(item.name, item);
      });
      this.hasInit = true;
      this.dummy.visible = true;
    }

    // if (this.selectedItemSlot != selectedItemSlot) {
    //   this.handleSelectedItemChange(selectedItemSlot);
    // }
  }

  handleSelectedItemChange(slot: number) {
    this.selectedItemSlot = slot;
    const item = this.itemSlots[this.selectedItemSlot].item;
    if (item == undefined) {
      this.removeItem(this.leftHand);
      this.removeItem(this.rightHand);
      return;
    }
    if (this.rightHand.item?.name == item.name) return;
    if (item.name == "pistol") {
      const mesh = AssetsManager.instance.models.get("pistol")!.scene.clone();
      this.scene.add(mesh);

      const pistol = new ClientWeapon("pistol", mesh);
      pistol.capacity = (item as ClientWeapon).capacity;
      pistol.ammo = (item as ClientWeapon).ammo;
      pistol.isReloading = (item as ClientWeapon).isReloading;

      this.rightHand.item = pistol;
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
      } else {
        this.interpolateWeight(idle, 0, delta);
        this.interpolateWeight(walkUpper, 0, delta);
        this.interpolateWeight(walkLower, 0, delta);
        this.interpolateWeight(strafeLeft, 0, delta);
        this.interpolateWeight(strafeRight, 0, delta);
        this.interpolateWeight(run, 0, delta);
        this.interpolateWeight(runningUpper, 0, delta);
        this.interpolateWeight(runningLower, 0, delta);
      }

      const rootBone = this.bones.get("Bone") as THREE.Bone;

      if (rootBone) {
        // pick source quaternion: local cam or remote view
        const sourceQuat = this.isLocalPlayer
          ? CameraManager.instance.getCamera().quaternion
          : this.viewQuaternion ?? new THREE.Quaternion();

        // get forward direction in world space
        const forwardWorld = new THREE.Vector3(0, 0, -1).applyQuaternion(
          sourceQuat
        );

        // convert to local player space
        const forwardLocal = forwardWorld.clone();
        this.dummy.worldToLocal(forwardLocal.add(this.dummy.position));

        // extract pitch & yaw from local direction
        const pitch = Math.atan2(
          forwardLocal.y,
          Math.sqrt(
            forwardLocal.x * forwardLocal.x + forwardLocal.z * forwardLocal.z
          )
        );
        let yaw = -Math.atan2(forwardLocal.x, -forwardLocal.z);

        // clamp yaw for aiming
        const maxTwist = Math.PI / 2.5;
        yaw = Math.max(-maxTwist, Math.min(maxTwist, yaw));

        // apply rotations to bone
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
      //this.interpolateWeight(run, 0, delta);
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
        //this.interpolateWeight(aimUpper, 1, delta);
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
  }

  updateHands() {
    if (!this.leftHand?.bone || !this.rightHand?.bone) return;
    if (!this.leftHand.item && !this.rightHand.item) return;

    const applyHandTransform = (hand: Hand) => {
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

  setSelectedItemSlot(slot: number) {
    this.selectedItemSlot = slot;

    this.handleSelectedItemChange(this.selectedItemSlot);
  }

  setHealth(n: number) {
    this.health = n;

    if (this.health <= 0) this.isDead = true;
  }

  updateSlots() {
    if (InputManager.instance.isActionJustPressed("slot1"))
      this.setSelectedItemSlot(0);
    else if (InputManager.instance.isActionJustPressed("slot2"))
      this.setSelectedItemSlot(1);
    else if (InputManager.instance.isActionJustPressed("slot3"))
      this.setSelectedItemSlot(2);
    else if (InputManager.instance.isActionJustPressed("slot4"))
      this.setSelectedItemSlot(3);
  }

  die() {
    if (!this.ragdollReady) {
      this.prepareRagdoll();

      if (this.isLocalPlayer) AudioManager.instance.playAudio("break", 0.1);
    }
  }

  update(delta: number) {
    if (this.isDead && this.ragdollReady) {
      this.ragdollPairs.forEach((pair, index) => {
        const rbPos = pair.physics.rigidBody.translation();
        const rbRot = pair.physics.rigidBody.rotation();

        pair.mesh.position.copy(rbPos);
        pair.mesh.quaternion.copy(rbRot);
      });
    }

    if (this.isDead) return;

    if (this.dummyCube) this.dummyCube.position.copy(this.getPosition());

    // if (this.rightHand.item) {
    //   console.log(this.rightHand.item, "item");
    // }
    // Check grounded before movement
    if (this.isGrounded()) {
      this.grounded = true;
      this.lastGroundedTime = Date.now();
    } else {
      this.grounded = false;
    }

    // this.predictMovement(delta);
    // this.updateAnimationState(delta);
    this.updateAudio();
    this.mixer.update(delta);

    this.updateAnimationState(delta);
    this.updateHands();

    this.debugCapsule.position.copy(this.dummy.position);

    // this.updateSlots();

    // if (leftArm && rightArm) {
    //   const baseRot = -Math.PI / 2;

    //   const cam = CameraManager.instance.getCamera();
    //   const cameraDir = new THREE.Vector3();
    //   cam.getWorldDirection(cameraDir);

    //   // Invert the pitch so looking up rotates arms up
    //   const pitch = -Math.atan2(
    //     cameraDir.y,
    //     Math.sqrt(cameraDir.x * cameraDir.x + cameraDir.z * cameraDir.z)
    //   );

    //   leftArm.rotation.z = baseRot + pitch;
    //   rightArm.rotation.z = baseRot + pitch;
    // }

    if (!this.isLocalPlayer && this.infoSprite) {
      if (!this.nickname) return;

      if (this.infoSprite.getText() == this.nickname) return;

      this.infoSprite.setText(this.nickname);

      console.log("Settting nickname", this.nickname);
    }
  }
}

export default ClientPlayer;
