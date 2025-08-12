import * as THREE from "three";
import World from "./World";

export default class Interactable {
  private world: World;
  private object: THREE.Object3D;

  constructor(
    id: string,
    world: World,
    object: THREE.Object3D,
    position: THREE.Vector3,
    quaternion: THREE.Quaternion
  ) {
    this.world = world;
    this.object = object;

    this.setPosition(position);
    this.setQuaternion(quaternion);
  }

  getPosition() {
    return this.object.position;
  }

  getObject() {
    return this.object;
  }

  setPosition(position: THREE.Vector3) {
    this.object.position.copy(position);
  }

  setQuaternion(quaternion: THREE.Quaternion) {
    this.object.quaternion.copy(quaternion);
  }
}
