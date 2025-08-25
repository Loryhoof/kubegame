import * as THREE from "three";
import Interactable from "./Interactable";
import { AssetsManager } from "./AssetsManager";
import ClientVehicle, { Wheel } from "./ClientVehicle";
import { getRandomFromArray } from "./utils";
import NetworkManager from "./NetworkManager";
import ClientNPC from "./ClientNPC";

const loader = new THREE.TextureLoader();

type WorldStateData = {
  vehicles: ClientVehicle[];
  npcs: ClientNPC[];
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
  public entities: any[] = [];
  public interactables: any[] = [];
  public vehicles: ClientVehicle[] = [];
  public npcs: any[] = [];

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

  registerObject(obj: THREE.Group) {
    this.scene.add(obj);

    const socket = NetworkManager.instance.getSocket();

    const geometries: any[] = [];
    const meshes: any[] = [];

    obj.children.forEach((child) => {
      if (child instanceof THREE.Mesh) {
        geometries.push(child.geometry.clone());
        meshes.push(child.clone());
      }
    });

    geometries[0].applyMatrix4(meshes[0].matrixWorld);
    geometries[0].attributes.position.needsUpdate = true;

    const dataObject = {
      position: obj.position,
      quaternion: {
        x: obj.quaternion.x,
        y: obj.quaternion.y,
        z: obj.quaternion.z,
        w: obj.quaternion.w,
      },
      vertices: geometries[0].attributes.position.array,
      indices: geometries[0].index.array,
    };

    socket.emit("register-object", dataObject);
  }

  init() {
    const light = new THREE.DirectionalLight(0xffffff, 1);
    this.scene.add(light);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    this.scene.add(ambientLight);

    const texture = loader.load("/prototype.jpg");
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(16 * 8, 16 * 8);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500, 1, 1),
      new THREE.MeshStandardMaterial({ map: texture })
    );

    const fogNear = 30;
    const fogFar = 200;
    const fog = new THREE.Fog(0x95f2f5, fogNear, fogFar);
    //this.scene.fog = fog;

    ground.position.z = -10;
    ground.position.y = -0.5;
    ground.rotation.x = -Math.PI / 2;

    ground.receiveShadow = true;

    this.scene.add(ground);
    this.entities.push({ id: 1, mesh: ground });

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
    const {
      zones,
      colliders,
      entities,
      interactables,
      vehicles,
      terrains,
      npcs,
    } = data;

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
      entities.forEach((entity: any) => {
        const { type } = entity;

        if (type == "box") {
          const { id, width, height, depth, position, quaternion, color } =
            entity;

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
        }

        if (type == "trimesh") {
          const { id, position, quaternion, modelName } = entity;

          const model = AssetsManager.instance.models
            .get(modelName)
            ?.scene.clone();

          if (model) {
            model.position.copy(position);
            model.quaternion.copy(quaternion);

            this.entities.push({ id: id, mesh: model });
            this.scene.add(model);
          }
        }
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
      vehicles.forEach((vehicle: ClientVehicle) => {
        const { id, position, quaternion, wheels } = vehicle;

        const clientVehicle = new ClientVehicle(
          id,
          position,
          quaternion,
          wheels
        );

        this.vehicles.push(clientVehicle);
        this.scene.add(clientVehicle.mesh);
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

        const cactusPositions: THREE.Vector3[] = [];
        const rockPositions: THREE.Vector3[] = [];

        const cactusObj = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 5, 0.3),
          new THREE.MeshStandardMaterial({ color: 0x00ff00 })
        );

        const rockObj = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshStandardMaterial({ color: 0x8c5c37 })
        );

        const objs = [cactusObj, rockObj];

        const lastHighest = new THREE.Vector3(0, 0, 0);

        let lowestHeight = Infinity;
        let highestHeight = -Infinity;

        // Row-major vertices, centered around origin
        for (let i = 0; i < nrows; i++) {
          for (let j = 0; j < ncols; j++) {
            const x = i - halfDepth; // i → X axis
            const y = newHeights[i * ncols + j];
            const z = j - halfWidth; // j → Z axis
            vertices.push(x, y, z);

            // apply the scale that you'll set on the mesh
            const worldX = x * (scale.x / (ncols - 1));
            const worldY = y * scale.y;
            const worldZ = z * (scale.z / (nrows - 1));

            // then apply the translation (mesh.position.copy(position))
            const finalX = worldX + position.x;
            const finalY = worldY + position.y;
            const finalZ = worldZ + position.z;

            if (worldY > lastHighest.y) {
              lastHighest.set(worldX, worldY, worldZ);
            }

            if (worldY > highestHeight) {
              highestHeight = worldY;
            }

            if (worldY < lowestHeight) {
              lowestHeight = worldY;
            }

            if (worldY >= 0) {
              if (Math.random() > 0.95) {
                let mesh = getRandomFromArray(["cactus", "rock"]);

                if (mesh == "cactus") {
                  cactusPositions.push(
                    new THREE.Vector3(finalX, finalY, finalZ)
                  );
                } else {
                  rockPositions.push(new THREE.Vector3(finalX, finalY, finalZ));
                }
              }
            }

            // UVs normalized to [0,1]
            const u = j / (ncols - 1);
            const v = i / (nrows - 1);
            uvs.push(u, v);
          }
        }

        console.log(lowestHeight, highestHeight, "LOWEST AND HIEHGTS");

        const waterPLane = new THREE.Mesh(
          new THREE.BoxGeometry(10000, 0.1, 1000),
          new THREE.MeshStandardMaterial({
            color: 0x47e7ff,
            transparent: true,
            opacity: 0.7,
          })
        );

        waterPLane.position.y = -1;

        // const bridge = new THREE.Mesh(
        //   new THREE.BoxGeometry(6, 0.5, 30),
        //   new THREE.MeshStandardMaterial({ color: 0x383838 })
        // );
        // bridge.position.set(60, 0, 28);
        // bridge.rotation.y = Math.PI / 2;

        // this.scene.add(bridge);

        this.scene.add(waterPLane);
        const cactusInstancedMesh = new THREE.InstancedMesh(
          cactusObj.geometry,
          cactusObj.material,
          cactusPositions.length
        );

        cactusPositions.forEach((position, index) => {
          const matrix4 = new THREE.Matrix4();
          matrix4.setPosition(position);

          cactusInstancedMesh.setMatrixAt(index, matrix4);
        });

        this.scene.add(cactusInstancedMesh);

        const rockInstancedMesh = new THREE.InstancedMesh(
          rockObj.geometry,
          rockObj.material,
          rockPositions.length
        );

        rockPositions.forEach((position, index) => {
          const matrix4 = new THREE.Matrix4();
          matrix4.setPosition(position);

          rockInstancedMesh.setMatrixAt(index, matrix4);
        });

        this.scene.add(rockInstancedMesh);

        const statueObj = new THREE.Mesh(
          new THREE.BoxGeometry(2, 10, 2),
          new THREE.MeshStandardMaterial({ color: 0x000000 })
        );
        statueObj.position.copy(lastHighest);
        this.scene.add(statueObj);

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
            minHeight: { value: lowestHeight }, // lowest terrain y
            maxHeight: { value: highestHeight }, // highest terrain y

            // Fog uniforms
            fogColor: { value: new THREE.Color(0xf7d299) }, // set to scene.fog.color
            fogNear: { value: 30 }, // match scene.fog.near
            fogFar: { value: 200 }, // match scene.fog.far
          },
          vertexShader: `
    varying float vHeight;
    varying vec3 vPosition;

    void main() {
      vHeight = position.y; // pass height to fragment shader
      vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz; // view-space position
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
          fragmentShader: `
    uniform vec3 baseColor;
    uniform float minHeight;
    uniform float maxHeight;

    uniform vec3 fogColor;
    uniform float fogNear;
    uniform float fogFar;

    varying float vHeight;
    varying vec3 vPosition;

    void main() {
      // normalize height to [0,1]
      float h = (vHeight - minHeight) / (maxHeight - minHeight);
      h = clamp(h, 0.0, 1.0);
      h = pow(h, 1.5); // exaggerates shadows in low regions

      // dark at low, bright at high
      vec3 color = baseColor * (0.4 + 1.0 * h);

      if(h < 0.20) {
        color = vec3(0.3294, 0.3294, 0.3294);


      };

     

      // ---- Fog ----
      float depth = length(vPosition);
      float fogFactor = smoothstep(fogNear, fogFar, depth);
      color = mix(color, fogColor, fogFactor);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
          side: THREE.DoubleSide,
          fog: true, // important! enables fog support
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

    if (npcs) {
      npcs.forEach((npc: any) => {
        const npcObject = new ClientNPC(npc.id, npc.color, this.scene, false);
        this.npcs.push(npcObject);
      });
    }
  }

  addVehicle(data: any) {
    const { id, position, quaternion, wheels } = data;

    const clientVehicle = new ClientVehicle(id, position, quaternion, wheels);

    this.vehicles.push(clientVehicle);
    this.scene.add(clientVehicle.mesh);
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
      const vehicle = this.vehicles[index] as ClientVehicle;
      vehicle.cleanup();
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
    const { vehicles, npcs } = data;

    // vehicles?.forEach((networkVehicle) => {
    //   const clientVehicle = this.getObjById(
    //     networkVehicle.id,
    //     this.vehicles
    //   ) as ClientVehicle;

    //   if (!clientVehicle) return;

    //   clientVehicle.updateState(
    //     networkVehicle.position,
    //     networkVehicle.quaternion,
    //     networkVehicle.wheels,
    //     networkVehicle.hornPlaying
    //   );
    // });

    // npcs?.forEach((networkNPC: any) => {
    //   const clientNPC = this.getObjById(
    //     networkNPC.networkId,
    //     this.npcs
    //   ) as ClientNPC;

    //   if (!clientNPC) return;

    //   clientNPC.setState({
    //     position: networkNPC.position,
    //     quaternion: networkNPC.quaternion,
    //     velocity: networkNPC.velocity,
    //     color: networkNPC.color,
    //   });
    // });
  }

  update(delta: number) {
    this.vehicles.forEach((vehicle: ClientVehicle) => {
      vehicle.update();
    });

    this.npcs.forEach((npc: ClientNPC) => {
      npc.update(delta);
    });
    // this.interactables.forEach((item) => {});
    // this.entities.forEach((entity: Entity) => {
    //   entity.update();
    // });
  }
}
