import * as THREE from "three";

type Entity = {
  name: string;
  update: () => {};
};

export default class World {
  private scene: THREE.Scene;
  private entities: Entity[];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.entities = [];
  }

  init() {
    const light = new THREE.DirectionalLight(0xffffff, 1);
    this.scene.add(light);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    this.scene.add(ambientLight);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100, 100, 100),
      new THREE.MeshStandardMaterial({ color: 0xffffff, wireframe: true })
    );

    ground.position.z = -10;
    ground.position.y = -0.5;
    ground.rotation.x = -Math.PI / 2;

    ground.receiveShadow = true;

    this.scene.add(ground);
  }

  update() {
    this.entities.forEach((entity: Entity) => {
      entity.update();
    });
  }
}
