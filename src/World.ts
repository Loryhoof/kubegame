import * as THREE from "three";
import Interactable from "./Interactable";

const loader = new THREE.TextureLoader();

type Wheel = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  radius: number;
};

type Vehicle = {
  id: string;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  wheels: Wheel[];
};

type WorldStateData = {
  vehicles: Vehicle[];
};

export default class World {
  private scene: THREE.Scene;
  private entities: any[] = [];
  public interactables: any[] = [];
  public vehicles: any[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  init() {
    const light = new THREE.DirectionalLight(0xffffff, 1);
    this.scene.add(light);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    this.scene.add(ambientLight);

    const texture = loader.load("/green.jpg");
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(16 * 12, 16 * 12);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1000, 1000, 1, 1),
      new THREE.MeshStandardMaterial({ map: texture })
    );

    const fog = new THREE.FogExp2(0x95f2f5, 0.0025);
    this.scene.fog = fog;

    ground.position.z = -10;
    ground.position.y = -0.5;
    ground.rotation.x = -Math.PI / 2;

    ground.receiveShadow = true;

    this.scene.add(ground);

    // this.createInteractable(
    //   new THREE.Mesh(
    //     new THREE.BoxGeometry(1, 1, 1),
    //     new THREE.MeshStandardMaterial({ color: 0xff0000 })
    //   ),
    //   new THREE.Vector3(10, 0, 10),
    //   new THREE.Quaternion()
    // );

    // this.createInteractable(
    //   new THREE.Mesh(
    //     new THREE.BoxGeometry(1, 1, 1),
    //     new THREE.MeshStandardMaterial({ color: 0xff0000 })
    //   ),
    //   new THREE.Vector3(10, 0, 20),
    //   new THREE.Quaternion()
    // );
  }

  getScene() {
    return this.scene;
  }

  // createInteractable(
  //   object: THREE.Object3D,
  //   position: THREE.Vector3,
  //   quaternion: THREE.Quaternion
  // ) {
  //   const interactable = new Interactable(this, object, position, quaternion);
  //   this.scene.add(interactable.getObject());
  //   this.interactables.push(interactable);
  // }

  initWorldData(data: any) {
    const { zones, colliders, entities, interactables, vehicles } = data;

    console.log(data, "DATa");
    if (zones) {
      zones.forEach((zone: any) => {
        const { id, width, height, depth, position, quaternion, color } = zone;

        const zoneMesh = new THREE.Mesh(
          new THREE.BoxGeometry(width, height, depth),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(color),
            transparent: true,
            opacity: 0.5,
          })
        );

        zoneMesh.position.set(position.x, position.y, position.z);
        zoneMesh.quaternion.set(
          quaternion.x,
          quaternion.y,
          quaternion.z,
          quaternion.w
        );

        this.entities.push({ id: id, mesh: zoneMesh });
        this.scene.add(zoneMesh);
      });
    }

    if (colliders) {
      colliders.forEach((zone: any) => {
        const { id, width, height, depth, position, quaternion, color } = zone;

        const colliderMesh = new THREE.Mesh(
          new THREE.BoxGeometry(width, height, depth),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(color),
          })
        );

        colliderMesh.position.set(position.x, position.y, position.z);
        colliderMesh.quaternion.set(
          quaternion.x,
          quaternion.y,
          quaternion.z,
          quaternion.w
        );

        this.entities.push({ id: id, mesh: colliderMesh });
        this.scene.add(colliderMesh);
      });
    }

    if (entities) {
      entities.forEach((zone: any) => {
        const { id, width, height, depth, position, quaternion, color } = zone;

        const entityMesh = new THREE.Mesh(
          new THREE.BoxGeometry(width, height, depth),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(color),
          })
        );

        entityMesh.position.set(position.x, position.y, position.z);
        entityMesh.quaternion.set(
          quaternion.x,
          quaternion.y,
          quaternion.z,
          quaternion.w
        );

        this.entities.push({ id: id, mesh: entityMesh });
        this.scene.add(entityMesh);
      });
    }

    if (interactables) {
      interactables.forEach((interactable: any) => {
        const { id, position, quaternion } = interactable;

        const interactableMesh = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xff0000),
            opacity: 0.6,
            transparent: true,
          })
        );

        interactableMesh.position.set(position.x, position.y, position.z);
        interactableMesh.quaternion.set(
          quaternion.x,
          quaternion.y,
          quaternion.z,
          quaternion.w
        );

        this.interactables.push({ id: id, mesh: interactableMesh });
        this.scene.add(interactableMesh);
      });
    }

    if (vehicles) {
      vehicles.forEach((vehicle: Vehicle) => {
        console.log(vehicle, "veh");
        const { id, position, quaternion, wheels } = vehicle;

        const vehicleMesh = new THREE.Mesh(
          new THREE.BoxGeometry(2, 0.5, 4),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xff0000),
          })
        );

        vehicleMesh.position.set(position.x, position.y, position.z);
        vehicleMesh.quaternion.set(
          quaternion.x,
          quaternion.y,
          quaternion.z,
          quaternion.w
        );

        let wheelArray = [] as any;

        if (wheels) {
          wheels.forEach((wheel: Wheel) => {
            // const wheelMesh = new THREE.Mesh(
            //   new THREE.CylinderGeometry(wheel.radius, wheel.radius, 0.2),
            //   new THREE.MeshStandardMaterial({ color: 0x00ff00 })
            // );

            const wheelMesh = new THREE.Mesh(
              new THREE.BoxGeometry(0.25, 0.5, 0.5),
              new THREE.MeshStandardMaterial({ color: 0x00ff00 })
            );

            vehicleMesh.add(wheelMesh);

            wheelMesh.position.set(
              wheel.position.x,
              wheel.position.y,
              wheel.position.z
            );

            //wheelMesh.rotation.z = Math.PI / 2;
            wheelMesh.rotation.z = Math.PI / 2;
            wheelMesh.quaternion.copy(wheel.quaternion);
            //wheelMesh.quaternion.copy(wheel.quaternion);

            wheelArray.push(wheelMesh);
          });
        }

        this.vehicles.push({ id: id, mesh: vehicleMesh, wheels: wheelArray });
        this.scene.add(vehicleMesh);
      });
    }
  }

  createZone(data: any) {
    const { id, width, height, depth, position, quaternion, color } = data;
    const zoneMesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.5,
      })
    );

    const centerX = position.x + width / 2;
    const centerY = position.y + height / 2;
    const centerZ = position.z + depth / 2;

    zoneMesh.position.set(centerX, centerY, centerZ);
    zoneMesh.quaternion.set(
      quaternion.x,
      quaternion.y,
      quaternion.z,
      quaternion.w
    );

    this.entities.push({ id: id, mesh: zoneMesh });
    this.scene.add(zoneMesh);
  }

  createInteractable(data: any) {
    const { id, position, quaternion } = data;

    const interactableMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xff0000),
        opacity: 0.6,
        transparent: true,
      })
    );

    interactableMesh.position.set(position.x, position.y, position.z);
    interactableMesh.quaternion.set(
      quaternion.x,
      quaternion.y,
      quaternion.z,
      quaternion.w
    );

    this.interactables.push({ id: id, mesh: interactableMesh });
    this.scene.add(interactableMesh);
  }

  removeByUUID(uuid: string) {
    // Find the index of the entity with matching id
    const index = this.entities.findIndex((entity) => entity.id === uuid);
    if (index !== -1) {
      const entity = this.entities[index];
      this.scene.remove(entity.mesh); // Remove mesh from scene
      this.entities.splice(index, 1); // Remove entity from array
    }
  }

  removeInteractableByUUID(uuid: string) {
    // Find the index of the entity with matching id
    const index = this.interactables.findIndex(
      (interactable) => interactable.id === uuid
    );
    if (index !== -1) {
      const interactable = this.interactables[index];
      this.scene.remove(interactable.mesh); // Remove mesh from scene
      this.interactables.splice(index, 1); // Remove entity from array
    }
  }

  getObjById(id: string, array: any[]) {
    for (const item of array) {
      if (id === item.id) return item;
    }
    return null;
  }

  updateState(data: WorldStateData) {
    const { vehicles } = data;

    vehicles.forEach((vehicle) => {
      const obj = this.getObjById(vehicle.id, this.vehicles) as any;

      if (obj && obj.mesh) {
        obj.mesh.position.copy(vehicle.position);
        obj.mesh.quaternion.copy(vehicle.quaternion);

        for (let i = 0; i < vehicle.wheels.length; i++) {
          const wheel = vehicle.wheels[i];
          const dummyWheel = obj.wheels[i];

          dummyWheel.quaternion.copy(wheel.quaternion);
        }
      }
    });
  }

  update() {
    // this.interactables.forEach((item) => {});
    // this.entities.forEach((entity: Entity) => {
    //   entity.update();
    // });
  }
}
