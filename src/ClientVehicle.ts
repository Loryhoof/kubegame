import * as THREE from "three";
import { AssetsManager } from "./AssetsManager";
import AudioManager from "./AudioManager";
import ClientPhysics, { PhysicsObject } from "./ClientPhysics";
import ClientPlayer from "./ClientPlayer";
import Wheel from "./Vehicle/Wheel";

export type VisualWheel = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  radius: number;
  worldPosition: THREE.Vector3;
};

type Seat = {
  position: THREE.Vector3;
  type: "driver" | "passenger";
  seater: ClientPlayer | null;
};

export type VehicleControls = {
  throttle: number;
  brake: number;
  steer: number;
};

export default class ClientVehicle {
  public id: string;
  public position: THREE.Vector3;
  public quaternion: THREE.Quaternion;
  public visualWheels: VisualWheel[];
  public raycastWheels: Wheel[];
  public mesh: THREE.Group;
  public sounds: Map<string, THREE.PositionalAudio>;
  public hornPlaying: boolean = false;

  public physicsObject: PhysicsObject | null = null;

  public seats: Seat[] = [];

  // specs
  private wheelBase: number = 2.55;
  private rearTrack: number = 1.525;
  private turnRadius: number = 10.8 * 0.5;

  private ackermannAngleLeft: number = 0;
  private ackermannAngleRight: number = 0;

  private steerSpeed: number = 2;

  public serverPos: THREE.Vector3 | null = null;
  public serverQuaternion: THREE.Quaternion | null = null;
  public serverVel: THREE.Vector3 | null = null;
  public serverLinearVelocity: THREE.Vector3 | null = null;
  public serverAngularVelocity: THREE.Vector3 | null = null;

  public controls: VehicleControls = { throttle: 0, brake: 0, steer: 0 };

  public lastServerTime: number = 0;

  public isLocal: boolean = false;

  private prevSeats: (ClientPlayer | null)[] = [];

  constructor(
    id: string,
    position: THREE.Vector3,
    quaternion: THREE.Quaternion,
    visualWheels: VisualWheel[],
    seats: Seat[],
    isLocal: boolean
  ) {
    this.id = id;
    this.position = position;
    this.quaternion = quaternion;
    this.seats = seats;
    this.isLocal = isLocal;

    if (this.isLocal) {
      this.physicsObject = ClientPhysics.instance.createCar(
        new THREE.Vector3(0, 0, 0)
      );
    }

    const mesh = AssetsManager.instance.getCarClone()!.scene as THREE.Group;

    this.mesh = mesh ? mesh : new THREE.Group();

    let wheelObjArr: any = [];

    this.mesh.traverse((item) => {
      if (item.name == "wheel_front_left") wheelObjArr[0] = item;

      if (item.name == "wheel_front_right") wheelObjArr[1] = item;

      if (item.name == "wheel_rear_left") wheelObjArr[2] = item;

      if (item.name == "wheel_rear_right") wheelObjArr[3] = item;
    });

    let wheelArray = [] as any;

    for (let i = 0; i < visualWheels.length; i++) {
      const wheel = visualWheels[i] as VisualWheel;

      const wheelMesh = wheelObjArr[i] as any;

      wheelMesh.position.copy(wheel.worldPosition);

      wheelMesh.rotation.z = Math.PI / 2;
      wheelMesh.rotation.z = Math.PI / 2;
      wheelMesh.quaternion.copy(wheel.quaternion);

      wheelArray.push(wheelMesh);
    }

    this.visualWheels = wheelArray;

    // this.seats = [
    //   {
    //     position: new THREE.Vector3(0.45, 0.2, 0.2),
    //     type: "driver",
    //     seater: null,
    //   },
    //   {
    //     position: new THREE.Vector3(-0.5, 0.2, 0.2),
    //     type: "passenger",
    //     seater: null,
    //   },
    //   {
    //     position: new THREE.Vector3(-0.5, 0.2, -0.6),
    //     type: "passenger",
    //     seater: null,
    //   },
    //   {
    //     position: new THREE.Vector3(0.45, 0.2, -0.6),
    //     type: "passenger",
    //     seater: null,
    //   },
    // ];

    this.raycastWheels = [
      new Wheel(
        this,
        0.5,
        new THREE.Vector3(1, -0.2, 1.5),
        new THREE.Quaternion(),
        "FrontLeft"
      ),
      new Wheel(
        this,
        0.5,
        new THREE.Vector3(-1, -0.2, 1.5),
        new THREE.Quaternion(),
        "FrontRight"
      ),
      new Wheel(
        this,
        0.5,
        new THREE.Vector3(1, -0.2, -1.5),
        new THREE.Quaternion(),
        "RearLeft"
      ),
      new Wheel(
        this,
        0.5,
        new THREE.Vector3(-1, -0.2, -1.5),
        new THREE.Quaternion(),
        "RearRight"
      ),
    ];

    this.sounds = new Map();

    this.initAudio();
  }

  initAudio() {
    const audioManager = AudioManager.instance;
    const listener = audioManager.getListener();
    const buffer = audioManager.getBufferByName("horn");

    const hornSound = new THREE.PositionalAudio(listener)
      .setVolume(0.5)
      .setLoop(true);

    if (buffer) hornSound.setBuffer(buffer);

    this.sounds.set("horn", hornSound);

    this.mesh.add(hornSound);
  }

  getDriver(): ClientPlayer | null {
    return this.seats[0].seater != null ? this.seats[0].seater : null;
  }

  cleanup() {
    this.sounds.forEach((sound) => {
      sound.stop();
      sound.disconnect();
      sound.buffer = null;
    });
  }

  updateRemoteState(
    networkPosition: THREE.Vector3,
    networkQuaternion: THREE.Quaternion,
    networkWheels: Wheel[],
    hornPlaying: boolean,
    networkSeats: Seat[]
  ) {
    if (!this.mesh) return;

    this.mesh.position.copy(networkPosition);
    this.mesh.quaternion.copy(networkQuaternion);

    this.hornPlaying = hornPlaying;

    // this.seats = networkSeats;

    for (let i = 0; i < networkWheels.length; i++) {
      const networkWheel = networkWheels[i];
      const clientWheel = this.visualWheels[i];

      clientWheel.quaternion.copy(networkWheel.quaternion);
      clientWheel.position.copy(networkWheel.worldPosition);
    }
  }

  updateState(hornPlaying: boolean, networkSeats: Seat[]) {
    if (!this.mesh) return;

    this.hornPlaying = hornPlaying;

    // --- Detect seat changes ---
    for (let i = 0; i < networkSeats.length; i++) {
      const prev = this.prevSeats[i] || null;
      const next = networkSeats[i].seater;

      if (prev !== next) {
        if (next) this.onEnterSeat(i, next);
        else if (prev) this.onExitSeat(i, prev);
      }
    }

    this.prevSeats = networkSeats.map((s) => s.seater); // store current state

    this.seats = networkSeats;
  }

  private onEnterSeat(seatIndex: number, player: ClientPlayer) {
    console.log(`Player ${player.networkId} entered seat ${seatIndex}`);

    if (player.isLocalPlayer) {
      if (this.physicsObject) return;

      this.physicsObject = ClientPhysics.instance.createCar(
        new THREE.Vector3(0, 0, 0)
      );

      this.isLocal = true;
      // Enable vehicle camera, controls, UI
      console.log("Local player entered vehicle → enable driving mode");
    }

    //player.controlledObject = this;
  }

  private onExitSeat(seatIndex: number, player: ClientPlayer) {
    player.controlledObject = null;

    console.log(`Player ${player.networkId} exited seat ${seatIndex}`);

    if (player.isLocalPlayer) {
      if (!this.physicsObject) return;

      ClientPhysics.instance.remove(this.physicsObject);
      this.physicsObject = null;
      this.isLocal = false;

      // Switch back to on-foot camera
      console.log("Local player exited vehicle → back to walking mode");
    }
  }

  updateVisualWheels() {
    for (let i = 0; i < this.visualWheels.length; i++) {
      const networkWheel = this.raycastWheels[i];
      const clientWheel = this.visualWheels[i];

      clientWheel.quaternion.copy(networkWheel.quaternion);
      clientWheel.position.copy(networkWheel.worldPosition);
    }
  }

  getKeys() {
    return this.getDriver() ? this.getDriver()?.getKeys() : null;
  }

  predictMovementCustom(keys: any) {
    if (!keys) return;

    const throttle = keys.w ? 1 : keys.s ? -1 : 0; // forward/back
    const brake = keys[" "] ? 1 : 0; // space = brake
    let steer = 0;
    if (keys.a) steer = 1; // left
    else if (keys.d) steer = -1; // right

    this.controls = { throttle, brake, steer };

    // Ackermann steering from steer input
    if (steer > 0) {
      // left
      this.ackermannAngleLeft =
        Math.atan(this.wheelBase / (this.turnRadius - this.rearTrack / 2)) *
        steer;
      this.ackermannAngleRight =
        Math.atan(this.wheelBase / (this.turnRadius + this.rearTrack / 2)) *
        steer;
    } else if (steer < 0) {
      // right
      this.ackermannAngleLeft =
        Math.atan(this.wheelBase / (this.turnRadius + this.rearTrack / 2)) *
        steer;
      this.ackermannAngleRight =
        Math.atan(this.wheelBase / (this.turnRadius - this.rearTrack / 2)) *
        steer;
    } else {
      this.ackermannAngleLeft = 0;
      this.ackermannAngleRight = 0;
    }
  }

  update(delta: number) {
    delta = 1 / 60;

    const horn = this.sounds.get("horn");
    if (this.hornPlaying) {
      if (!horn?.isPlaying) {
        horn?.play();
      }
    } else {
      horn?.stop();
    }

    ///

    this.raycastWheels.forEach((wheel) => {
      let targetSteerAngle = 0;

      if (wheel.wheelType === "FrontLeft")
        targetSteerAngle = this.ackermannAngleLeft;
      if (wheel.wheelType === "FrontRight")
        targetSteerAngle = this.ackermannAngleRight;

      // Gradually approach target angle
      wheel.steerAngle +=
        (targetSteerAngle - wheel.steerAngle) *
        Math.min(1, this.steerSpeed * delta);

      wheel.update(delta);
    });

    if (this.physicsObject) {
      const { x, y, z } = this.physicsObject.rigidBody.translation();
      let rot = this.physicsObject.rigidBody.rotation();

      this.mesh.position.set(x, y, z);
      this.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
    }

    // console.log(this.getDriver());

    //

    // this.mesh.position.copy(this.physicsObject.rigidBody.translation());

    this.updateVisualWheels();
  }
}
