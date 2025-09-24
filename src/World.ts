import * as THREE from "three";
import Interactable from "./Interactable";
import { AssetsManager } from "./AssetsManager";
import ClientVehicle, { VisualWheel } from "./ClientVehicle";
import { getRandomFromArray } from "./utils";
import NetworkManager from "./NetworkManager";
import ClientNPC from "./ClientNPC";
import ClientPhysics from "./ClientPhysics";
import ClientPlayer from "./ClientPlayer";
import TerrainManager, { TerrainData } from "./Terrain/TerrainManager";

const base = import.meta.env.BASE_URL;

const loader = new THREE.TextureLoader();

type WorldStateData = {
  vehicles: ClientVehicle[];
  npcs: ClientNPC[];
};

export default class World {
  private scene: THREE.Scene;
  public entities: any[] = [];
  public interactables: any[] = [];
  public vehicles: ClientVehicle[] = [];
  public npcs: any[] = [];
  public players: Map<string, ClientPlayer> = new Map();

  private terrainManager: TerrainManager;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.terrainManager = new TerrainManager(scene);
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

  async init() {
    await ClientPhysics.instance.init();

    const light = new THREE.DirectionalLight(0xffffff, 1);
    this.scene.add(light);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    this.scene.add(ambientLight);

    const texture = loader.load(`${base}prototype.jpg`);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(16 * 8, 16 * 8);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500, 1, 1),
      new THREE.MeshStandardMaterial({ map: texture })
    );

    const fogNear = 30;
    const fogFar = 200;
    const fog = new THREE.Fog(0xf7d599, fogNear, fogFar);
    //this.scene.fog = fog;

    ground.position.z = -10;
    ground.position.y = -0.5;
    ground.rotation.x = -Math.PI / 2;

    ground.receiveShadow = true;

    // this.scene.add(ground);
    //this.entities.push({ id: 1, mesh: ground });

    this.genWorld();

    // ground
    ClientPhysics.instance.createFixedBox(
      new THREE.Vector3(0, -0.5, 0),
      new THREE.Vector3(500, 0.1, 500)
    );
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

          const collider = AssetsManager.instance.colliders.get(modelName);
          let physicsObject = null;

          if (model) {
            model.position.copy(position);
            model.quaternion.copy(quaternion);
            this.scene.add(model);
          }

          if (collider) {
            physicsObject = ClientPhysics.instance.createTrimesh(
              position,
              quaternion,
              collider.vertices,
              new Uint32Array(collider.indices)
            );
          }

          this.entities.push({
            id: id,
            mesh: model,
            physicsObject: physicsObject,
          });
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
      console.log(vehicles, "VEHICLES ON INIT");
      vehicles.forEach((vehicle: any) => {
        let { id, position, quaternion, wheels, seats } = vehicle;

        if (seats) {
          seats = seats.map((seat: any) => ({
            ...seat,
            seater: seat.seater ? this.getPlayerById(seat.seater) : null,
          }));
        }

        const clientVehicle = new ClientVehicle(
          id,
          position,
          quaternion,
          wheels,
          seats,
          false,
          this.scene
        );

        this.vehicles.push(clientVehicle);
        this.scene.add(clientVehicle.mesh);
      });
    }
    if (terrains) {
      terrains.forEach((terrain: TerrainData) => {
        this.terrainManager.create(terrain);
      });
    }

    if (npcs) {
      npcs.forEach((npc: any) => {
        const npcObject = new ClientNPC(npc.id, npc.color, this.scene, false);
        this.npcs.push(npcObject);
      });
    }
  }

  addNPC(data: any) {
    const npcObject = new ClientNPC(data.id, data.color, this.scene, false);
    this.npcs.push(npcObject);
  }

  addVehicle(data: any) {
    const { id, position, quaternion, wheels, seats } = data;

    // Determine if this car belongs to the local player
    const isLocal = seats[0]?.seater === NetworkManager.instance.localId;

    const clientVehicle = new ClientVehicle(
      id,
      new THREE.Vector3(position.x, position.y, position.z),
      new THREE.Quaternion(
        quaternion.x,
        quaternion.y,
        quaternion.z,
        quaternion.w
      ),
      wheels,
      seats,
      isLocal,
      this.scene
    );

    this.vehicles.push(clientVehicle);
    this.scene.add(clientVehicle.mesh);
  }

  addPlayer(player: ClientPlayer) {
    this.players.set(player.networkId, player);
  }

  removePlayer(key: string) {
    const player = this.players.get(key);

    if (!player) return;

    player.remove();

    this.players.delete(key);
  }

  getPlayerById(id: string): ClientPlayer | null {
    return this.players.get(id) ?? null;
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

  createHitmarker(position: THREE.Vector3) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );

    this.scene.add(mesh);
    mesh.position.copy(position);

    setTimeout(() => {
      this.scene.remove(mesh);
    }, 5000);
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

  removeNPCByUUID(uuid: string) {
    console.log("wanting to remove npc");
    const index = this.npcs.findIndex((npc) => npc.networkId === uuid);
    console.log(index);
    if (index !== -1) {
      const npc = this.npcs[index] as ClientNPC;

      npc.cleanup();
      this.scene.remove(npc.dummy); // Remove mesh from scene
      // ClientPhysics.instance.remove(npc.phy)
      this.npcs.splice(index, 1); // Remove entity from array
    }
  }

  getObjById(id: string, array: any[]) {
    for (const item of array) {
      if (id === item.id) return item;
      if (id == item.networkId) return item;
    }
    return null;
  }

  // createTerrain() {
  //   const nrows = 200;
  //   const ncols = 200;
  //   const heights = new Float32Array(nrows * ncols);

  //   const position = new THREE.Vector3();
  //   const quaternion = new THREE.Quaternion();

  //   const scaleFactor = 3;
  //   const heightScaleFactor = 1.5;

  //   const roadWidth = 6;
  //   const roadFlattenHeight = -1.5;

  //   const circleA = { centerX: 0, centerZ: 0, radius: 10 };
  //   const circleB = { centerX: 200, centerZ: 200, radius: 10 };

  //   const noise2D = createNoise2D();

  //   // Define Bezier control points for the road
  //   const roadP0 = new THREE.Vector3(circleA.centerX, 0, circleA.centerZ);
  //   const roadP1 = new THREE.Vector3(circleA.centerX + 100, 0, circleA.centerZ);
  //   const roadP2 = new THREE.Vector3(circleB.centerX, 0, circleB.centerZ + 100);
  //   const roadP3 = new THREE.Vector3(circleB.centerX, 0, circleB.centerZ);

  //   for (let x = 0; x < nrows; x++) {
  //     for (let z = 0; z < ncols; z++) {
  //       const index = x * ncols + z;

  //       let noise = noise2D(x, z);
  //       let sinZ = Math.sin(z) * 0.1 + noise * 0.05;
  //       let sinX = Math.sin(x) * 0.1 + noise * 0.05;
  //       let currentHeight = sinX + sinZ;

  //       // Flatten circles
  //       const dxA = circleA.centerX - x;
  //       const dzA = circleA.centerZ - z;
  //       const distanceFromCircleA = Math.sqrt(dxA * dxA + dzA * dzA);

  //       const dxB = circleB.centerX - x;
  //       const dzB = circleB.centerZ - z;
  //       const distanceFromCircleB = Math.sqrt(dxB * dxB + dzB * dzB);

  //       if (
  //         distanceFromCircleA <= circleA.radius ||
  //         distanceFromCircleB <= circleB.radius
  //       ) {
  //         currentHeight = roadFlattenHeight;
  //       } else {
  //         // Flatten along Bezier road
  //         const point = new THREE.Vector3(x, 0, z);
  //         const distToRoad = distanceToBezier(
  //           point,
  //           roadP0,
  //           roadP1,
  //           roadP2,
  //           roadP3
  //         );
  //         if (distToRoad <= roadWidth / 2) {
  //           currentHeight = roadFlattenHeight;
  //         }
  //       }

  //       heights[index] = currentHeight;
  //     }
  //   }

  //   const scale = new THREE.Vector3(
  //     nrows * scaleFactor,
  //     2 * heightScaleFactor,
  //     ncols * scaleFactor
  //   );

  //   // const terrainData: TerrainData = {
  //   //   position,
  //   //   quaternion,
  //   //   heights,
  //   //   nrows,
  //   //   ncols,
  //   //   scale,
  //   // };

  //   // this.terrains.push(terrainData);

  //   ClientPhysics.instance.createHeightfield(
  //     position,
  //     quaternion,
  //     heights,
  //     scale,
  //     nrows - 1,
  //     ncols - 1
  //   );
  // }

  updateState(worldData: WorldStateData) {
    const { vehicles, npcs } = worldData;

    vehicles?.forEach((networkVehicle) => {
      const clientVehicle = this.getObjById(
        networkVehicle.id,
        this.vehicles
      ) as ClientVehicle;

      if (!clientVehicle) return;

      //    clientVehicle.updateState(
      //     networkVehicle.position,
      //     networkVehicle.quaternion,
      //     networkVehicle.wheels,
      //     networkVehicle.hornPlaying,
      //     networkVehicle.seats
      //   );
      // });

      let seats = networkVehicle.seats;

      seats = seats.map((seat: any) => ({
        ...seat,
        seater: seat.seater ? this.getPlayerById(seat.seater) : null,
      }));

      clientVehicle.updateState(networkVehicle.hornPlaying, seats);
    });

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
    ClientPhysics.instance.update();

    this.vehicles.forEach((vehicle: ClientVehicle) => {
      vehicle.update(delta);
    });

    this.npcs.forEach((npc: ClientNPC) => {
      // console.log(npc.getPosition(), npc.networkId);
      npc.update(delta);
    });

    // this.interactables.forEach((item) => {});
    // this.entities.forEach((entity: Entity) => {
    //   entity.update();
    // });
  }
}
