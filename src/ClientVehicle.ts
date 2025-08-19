import * as THREE from "three";
import { AssetsManager } from "./AssetsManager";
import AudioManager from "./AudioManager";

export type Wheel = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  radius: number;
  worldPosition: THREE.Vector3;
};

export default class ClientVehicle {
  public id: string;
  public position: THREE.Vector3;
  public quaternion: THREE.Quaternion;
  public wheels: Wheel[];
  public mesh: THREE.Group;
  public sounds: Map<string, THREE.PositionalAudio>;
  public hornPlaying: boolean = false;

  constructor(
    id: string,
    position: THREE.Vector3,
    quaternion: THREE.Quaternion,
    wheels: Wheel[]
  ) {
    this.id = id;
    this.position = position;
    this.quaternion = quaternion;

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

    for (let i = 0; i < wheels.length; i++) {
      const wheel = wheels[i] as Wheel;

      const wheelMesh = wheelObjArr[i] as any;

      wheelMesh.position.copy(wheel.worldPosition);

      wheelMesh.rotation.z = Math.PI / 2;
      wheelMesh.rotation.z = Math.PI / 2;
      wheelMesh.quaternion.copy(wheel.quaternion);

      wheelArray.push(wheelMesh);
    }

    this.wheels = wheelArray;

    // sounds

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

  cleanup() {
    this.sounds.forEach((sound) => {
      sound.stop();
      sound.disconnect();
      sound.buffer = null;
    });
  }

  updateState(
    networkPosition: THREE.Vector3,
    networkQuaternion: THREE.Quaternion,
    networkWheels: Wheel[],
    hornPlaying: boolean
  ) {
    if (!this.mesh) return;

    this.mesh.position.copy(networkPosition);
    this.mesh.quaternion.copy(networkQuaternion);

    this.hornPlaying = hornPlaying;

    for (let i = 0; i < networkWheels.length; i++) {
      const networkWheel = networkWheels[i];
      const clientWheel = this.wheels[i];

      clientWheel.quaternion.copy(networkWheel.quaternion);
      clientWheel.position.copy(networkWheel.worldPosition);
    }
  }

  update() {
    const horn = this.sounds.get("horn");
    if (this.hornPlaying) {
      if (horn?.isPlaying) return;

      horn?.play();
    } else {
      horn?.stop();
    }
  }
}
