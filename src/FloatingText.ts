import * as THREE from "three";

export default class FloatingText {
  public sprite: THREE.Sprite;
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;

  constructor(message: string, color: string = "#ffffff") {
    // Create canvas & context
    this.canvas = document.createElement("canvas");
    this.canvas.width = 256;
    this.canvas.height = 64;
    this.context = this.canvas.getContext("2d")!;

    // Create texture & sprite
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
    });
    this.sprite = new THREE.Sprite(material);

    // Scale (world units)
    this.sprite.scale.set(2, 0.5, 1);

    // Draw initial text
    this.setText(message, color);
  }

  setText(message: string, color: string = "#ffffff") {
    const ctx = this.context;

    // Clear previous
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw new text
    ctx.font = "Bold 21px Arial";
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(message, this.canvas.width / 2, this.canvas.height / 2);

    // Update texture
    this.texture.needsUpdate = true;
  }

  setPositionAbove(object: THREE.Object3D, height: number = 2.5) {
    this.sprite.position.set(0, height, 0);
    object.add(this.sprite);
  }

  alwaysFaceCamera(camera: THREE.Camera) {
    this.sprite.quaternion.copy(camera.quaternion);
  }
}
