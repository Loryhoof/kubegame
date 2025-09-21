import { Object3D } from "three";

export interface IHoldable {
  name: string;
  object: Object3D;
  cooldownTime: number;
  equip(): void;
  unequip(): void;
  use(): void;
}
