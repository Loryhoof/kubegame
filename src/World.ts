import * as THREE from "three";
import Interactable from "./Interactable";
import { AssetsManager } from "./AssetsManager";

const loader = new THREE.TextureLoader();

type Wheel = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  radius: number;
  worldPosition: THREE.Vector3;
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

type TerrainData = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  heights: ArrayBuffer;
  nrows: number;
  ncols: number;
  scale: THREE.Vector3;
};

export default class World {
  private scene: THREE.Scene;
  private entities: any[] = [];
  public interactables: any[] = [];
  public vehicles: any[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  genWorld() {
    // const ground = new THREE.Mesh(
    //   new THREE.BoxGeometry(200, 0.5, 200),
    //   new THREE.MeshStandardMaterial({ color: 0x8f8f8f })
    // );
    // ground.position.y = -0.65;
    // this.scene.add(ground);
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

    //this.scene.add(ground);

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

    this.genWorld();
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
    const { zones, colliders, entities, interactables, vehicles, terrains } =
      data;

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
        const { id, position, quaternion, wheels } = vehicle;

        // const vehicleMesh = new THREE.Mesh(
        //   new THREE.BoxGeometry(2, 0.5, 4),
        //   new THREE.MeshStandardMaterial({
        //     color: new THREE.Color(0xff0000),
        //   })
        // );

        const vehicleMesh = AssetsManager.instance.getCarClone()?.scene;

        if (!vehicleMesh) {
          console.log("No vehicle");
          return;
        }

        vehicleMesh.position.set(position.x, position.y, position.z);
        vehicleMesh.quaternion.set(
          quaternion.x,
          quaternion.y,
          quaternion.z,
          quaternion.w
        );

        let wheelObjFrontLeft,
          wheelObjFrontRight,
          wheelObjRearLeft,
          wheelObjRearRight;

        let wheelObjArr: any = [];

        vehicleMesh.traverse((item) => {
          // console.log(item.name);

          if (item.name == "wheel_front_left") wheelObjArr[0] = item;

          if (item.name == "wheel_front_right") wheelObjArr[1] = item;

          if (item.name == "wheel_rear_left") wheelObjArr[2] = item;

          if (item.name == "wheel_rear_right") wheelObjArr[3] = item;
        });

        let wheelArray = [] as any;

        if (wheels) {
          for (let i = 0; i < wheels.length; i++) {
            const wheel = wheels[i] as Wheel;

            const wheelMesh = wheelObjArr[i] as any;

            //if (!wheelMesh) return;

            wheelMesh.position.copy(wheel.worldPosition);

            wheelMesh.rotation.z = Math.PI / 2;
            wheelMesh.rotation.z = Math.PI / 2;
            wheelMesh.quaternion.copy(wheel.quaternion);

            wheelArray.push(wheelMesh);
          }
          // for (let i = 0; i < wheels.length; i++) {
          //   const wheel = wheels[i] as Wheel;

          //   const wheelMesh = wheelObjArr[i] as any;

          //   if (!wheelMesh) return;

          //   //vehicle.add(wheelMesh);

          //   //this.scene.add(wheelMesh);

          //   //wheelMesh.position.copy(wheel.position);

          //   //wheelArray.push(wheelMesh);
          // }
          // wheels.forEach((wheel: Wheel) => {
          //   // const wheelMesh = new THREE.Mesh(
          //   //   new THREE.CylinderGeometry(wheel.radius, wheel.radius, 0.2),
          //   //   new THREE.MeshStandardMaterial({ color: 0x00ff00 })
          //   // );

          //   const wheelMesh = new THREE.Mesh(
          //     new THREE.BoxGeometry(0.25, 0.5, 0.5),
          //     new THREE.MeshStandardMaterial({ color: 0x00ff00 })
          //   );

          //   vehicleMesh.add(wheelMesh);

          //   wheelMesh.position.set(
          //     wheel.position.x,
          //     wheel.position.y,
          //     wheel.position.z
          //   );

          //   //wheelMesh.rotation.z = Math.PI / 2;
          //   wheelMesh.rotation.z = Math.PI / 2;
          //   wheelMesh.quaternion.copy(wheel.quaternion);
          //   //wheelMesh.quaternion.copy(wheel.quaternion);

          //   wheelArray.push(wheelMesh);
          // });
        }

        this.vehicles.push({ id: id, mesh: vehicleMesh, wheels: wheelArray });
        this.scene.add(vehicleMesh);
      });
    }
    if (terrains) {
      terrains.forEach((terrain: TerrainData) => {
        const { position, heights, nrows, ncols, scale } = terrain;

        const newHeights = new Float32Array(heights);

        const geometry = new THREE.BufferGeometry();
        const vertices: number[] = [];
        const indices: number[] = [];
        const uvs: number[] = [];

        // Compute half-size to center the mesh
        const halfWidth = (ncols - 1) / 2;
        const halfDepth = (nrows - 1) / 2;

        // Row-major vertices, centered around origin
        for (let i = 0; i < nrows; i++) {
          for (let j = 0; j < ncols; j++) {
            const x = i - halfDepth; // i → X axis
            const y = newHeights[i * ncols + j];
            const z = j - halfWidth; // j → Z axis
            vertices.push(x, y, z);

            // UVs normalized to [0,1]
            const u = j / (ncols - 1);
            const v = i / (nrows - 1);
            uvs.push(u, v);
          }
        }

        // Create triangle indices
        for (let i = 0; i < nrows - 1; i++) {
          for (let j = 0; j < ncols - 1; j++) {
            const a = i * ncols + j;
            const b = i * ncols + (j + 1);
            const c = (i + 1) * ncols + j;
            const d = (i + 1) * ncols + (j + 1);

            indices.push(a, b, d);
            indices.push(a, d, c);
          }
        }

        geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(vertices, 3)
        );
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        // const texture = loader.load("/green.jpg");
        // texture.wrapS = THREE.RepeatWrapping;
        // texture.wrapT = THREE.RepeatWrapping;
        // texture.repeat.set(16 * 12, 16 * 12);

        const shaderMaterial = new THREE.ShaderMaterial({
          uniforms: {
            baseColor: { value: new THREE.Color(0xf7d299) }, // green base color
            minHeight: { value: -1.0 }, // lowest terrain y
            maxHeight: { value: 1.0 }, // highest terrain y
          },
          vertexShader: `
          varying float vHeight;

          void main() {
            vHeight = position.y; // pass height to fragment shader
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
          fragmentShader: `
          uniform vec3 baseColor;
          uniform float minHeight;
          uniform float maxHeight;
          varying float vHeight;

          void main() {
            // normalize height to [0,1]
            // float h = (vHeight - minHeight) / (maxHeight - minHeight);
            // h = clamp(h, 0.0, 1.0);

            float h = (vHeight - minHeight) / (maxHeight - minHeight);
            h = clamp(h, 0.0, 1.0);
            h = pow(h, 1.5); // exaggerates shadows in low regions


            // dark at low, bright at high
            vec3 color = baseColor * (0.4 + 1.0 * h);

            gl_FragColor = vec4(color, 1.0);
          }
        `,
          side: THREE.DoubleSide,
        });

        const material = new THREE.MeshStandardMaterial({
          color: 0xff0000,
          wireframe: true,
          side: THREE.DoubleSide,
        });

        const mesh = new THREE.Mesh(geometry, shaderMaterial);

        // Apply world transform (Rapier heightfield position)
        mesh.position.copy(position);

        // Apply scale to match physics heightfield
        mesh.scale.set(scale.x / (ncols - 1), scale.y, scale.z / (nrows - 1));

        this.scene.add(mesh);
      });
    }
  }

  addVehicle(data: any) {
    const { id, position, quaternion, wheels } = data;

    const vehicleMesh = AssetsManager.instance.getCarClone()?.scene;

    if (!vehicleMesh) {
      console.log("No vehicle");
      return;
    }

    vehicleMesh.position.set(position.x, position.y, position.z);
    vehicleMesh.quaternion.set(
      quaternion.x,
      quaternion.y,
      quaternion.z,
      quaternion.w
    );

    let wheelObjArr: any = [];

    vehicleMesh.traverse((item) => {
      if (item.name == "wheel_front_left") wheelObjArr[0] = item;

      if (item.name == "wheel_front_right") wheelObjArr[1] = item;

      if (item.name == "wheel_rear_left") wheelObjArr[2] = item;

      if (item.name == "wheel_rear_right") wheelObjArr[3] = item;
    });

    let wheelArray = [] as any;

    if (wheels) {
      for (let i = 0; i < wheels.length; i++) {
        const wheel = wheels[i] as Wheel;

        const wheelMesh = wheelObjArr[i] as any;

        wheelMesh.position.copy(wheel.worldPosition);

        wheelMesh.rotation.z = Math.PI / 2;
        wheelMesh.rotation.z = Math.PI / 2;
        wheelMesh.quaternion.copy(wheel.quaternion);

        wheelArray.push(wheelMesh);
      }
    }

    this.vehicles.push({ id: id, mesh: vehicleMesh, wheels: wheelArray });
    this.scene.add(vehicleMesh);
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

  removeVehicleByUUID(uuid: string) {
    const index = this.vehicles.findIndex((vehicle) => vehicle.id === uuid);
    if (index !== -1) {
      const vehicle = this.vehicles[index];
      this.scene.remove(vehicle.mesh); // Remove mesh from scene
      this.vehicles.splice(index, 1); // Remove entity from array
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
        //obj.mesh.visible = false;
        //obj.mesh.position.copy(new THREE.Vector3(0, 0, 0));

        //obj.mesh.position.lerp(vehicle.position, 0.9);

        for (let i = 0; i < vehicle.wheels.length; i++) {
          const wheel = vehicle.wheels[i];
          const dummyWheel = obj.wheels[i];

          dummyWheel.quaternion.copy(wheel.quaternion);
          dummyWheel.position.copy(wheel.worldPosition);
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
