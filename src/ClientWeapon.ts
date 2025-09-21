import * as THREE from "three";
import { IHoldable } from "./interfaces/IHoldable";
import AudioManager from "./AudioManager";

export default class ClientWeapon implements IHoldable {
  public name: string;
  public object: THREE.Object3D;
  public cooldownTime: number;
  public sounds: Map<string, THREE.PositionalAudio> = new Map();
  public ammo: number = 0;
  public isReloading: boolean = false;
  public capacity: number = 0;

  constructor(name: string, object: THREE.Object3D, cooldownTime: number = 50) {
    this.name = name;
    this.object = object;
    this.cooldownTime = cooldownTime;

    this.initAudio();
  }

  initAudio() {
    const audioManager = AudioManager.instance;
    const listener = audioManager.getListener();

    const pistolBuffer = audioManager.getBufferByName("pistol_shot_1");
    const emptyBuffer = audioManager.getBufferByName("empty_shot");

    const pistolSound = new THREE.PositionalAudio(listener)
      .setVolume(0.1)
      .setLoop(false);

    const emptySound = new THREE.PositionalAudio(listener)
      .setVolume(0.1)
      .setLoop(false);

    if (pistolBuffer) pistolSound.setBuffer(pistolBuffer);
    if (emptyBuffer) emptySound.setBuffer(emptyBuffer);

    this.sounds.set("pistol_shot_1", pistolSound);
    this.sounds.set("empty_shot", emptySound);

    this.object.add(pistolSound, emptySound);
  }

  equip(): void {}
  unequip(): void {}

  use(): boolean {
    if (this.ammo <= 0) {
      const emptySound = this.sounds.get("empty_shot");
      if (emptySound && !this.isReloading) {
        if (emptySound.isPlaying) emptySound.stop();
        emptySound.play();
      }
      return false; // nothing fired
    }

    this.ammo--; // consume ammo only if shot fired

    const shootSound = this.sounds.get("pistol_shot_1");
    if (shootSound) {
      if (shootSound.isPlaying) shootSound.stop();
      shootSound.play();
    }

    return true; // actual shot fired
  }
}
