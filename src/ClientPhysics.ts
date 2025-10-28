import * as RAPIER from "@dimforge/rapier3d-compat";
import { Quaternion, Vector3 } from "three";

let ray = new RAPIER.Ray(
  new RAPIER.Vector3(0, 0, 0),
  new RAPIER.Vector3(0, 0, 0)
);

export interface PhysicsObject {
  rigidBody: RAPIER.RigidBody;
  collider: RAPIER.Collider;
}

export default class ClientPhysics {
  private static _instance: ClientPhysics | null = null;
  public physicsWorld: RAPIER.World | null = null;
  private physicsIsReady: boolean = false;

  public static get instance(): ClientPhysics {
    if (!this._instance) {
      this._instance = new ClientPhysics();
    }
    return this._instance;
  }

  private constructor() {}

  async init(): Promise<void> {
    await RAPIER.init();

    this.physicsWorld = new RAPIER.World(new RAPIER.Vector3(0.0, -9.81, 0.0));

    this.physicsIsReady = true;
  }

  restart() {
    this.physicsIsReady = false;
    this.physicsWorld = new RAPIER.World(new RAPIER.Vector3(0.0, -9.81, 0.0));
    this.physicsIsReady = true;
  }

  createPlayerCapsule(): PhysicsObject {
    if (!this.physicsIsReady) {
      console.log("Pjysics aint ready");
    }
    let rbDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 5, 0)
      .setCcdEnabled(true)
      .lockRotations(); //kinematicVelocityBased
    let rigidBody = this.physicsWorld!.createRigidBody(rbDesc);

    let halfHeight = 0.55; // weird s
    let radius = 0.275;

    let capsuleColDesc = RAPIER.ColliderDesc.capsule(halfHeight, radius);
    let collider = this.physicsWorld!.createCollider(capsuleColDesc, rigidBody);

    return { rigidBody, collider };
  }

  createSphericalJoint(
    a: PhysicsObject,
    b: PhysicsObject,
    localAnchorA: Vector3,
    localAnchorB: Vector3
  ) {
    if (!this.physicsWorld) return;

    const params = RAPIER.JointData.spherical(
      { x: localAnchorA.x, y: localAnchorA.y, z: localAnchorA.z },
      { x: localAnchorB.x, y: localAnchorB.y, z: localAnchorB.z }
    );

    this.physicsWorld.createImpulseJoint(
      params,
      a.rigidBody,
      b.rigidBody,
      true
    );
  }

  // createFixedJoint(
  //   a: PhysicsObject,
  //   b: PhysicsObject,
  //   localAnchorA: Vector3,
  //   localAnchorB: Vector3
  // ) {
  //   if (!this.physicsWorld) return;

  //   const params = RAPIER.JointData.fixed(
  //     { x: localAnchorA.x, y: localAnchorA.y, z: localAnchorA.z },
  //     { x: localAnchorB.x, y: localAnchorB.y, z: localAnchorB.z },
  //     { x: 0, y: 0, z: 0, w: 1 } // identity rotation
  //   );

  //   this.physicsWorld.createImpulseJoint(params, a.rigidBody, b.rigidBody, true);
  // }

  createDynamicBox(position: Vector3, scale: Vector3): PhysicsObject {
    const rbDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(
      position.x,
      position.y,
      position.z
    );
    const rigidBody = this.physicsWorld!.createRigidBody(rbDesc);

    const colDesc = RAPIER.ColliderDesc.cuboid(scale.x, scale.y, scale.z);
    const collider = this.physicsWorld!.createCollider(colDesc, rigidBody);

    return { rigidBody, collider };
  }

  createDynamicBall(position: Vector3, radius: number): PhysicsObject {
    const rbDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(
      position.x,
      position.y,
      position.z
    );
    const rigidBody = this.physicsWorld!.createRigidBody(rbDesc);

    const colDesc = RAPIER.ColliderDesc.ball(radius);
    const collider = this.physicsWorld!.createCollider(colDesc, rigidBody);

    return { rigidBody, collider };
  }

  createFixedBox(
    position: Vector3,
    scale: Vector3,
    rotation: Quaternion = new Quaternion(0, 0, 0, 1)
  ): PhysicsObject {
    const rbDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(position.x, position.y, position.z)
      .setRotation({
        w: rotation.w,
        x: rotation.x,
        y: rotation.y,
        z: rotation.z,
      });
    const rigidBody = this.physicsWorld!.createRigidBody(rbDesc);

    const colDesc = RAPIER.ColliderDesc.cuboid(
      scale.x / 2,
      scale.y / 2,
      scale.z / 2
    );
    const collider = this.physicsWorld!.createCollider(colDesc, rigidBody);

    return { rigidBody, collider };
  }

  grounded(rigidBody: RAPIER.RigidBody) {
    const origin = rigidBody.translation();
    const ray = new RAPIER.Ray(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: 0, y: -1, z: 0 }
    );

    const maxToi = 1.0;
    const solid = false;
    let filterFlags = undefined;
    let filterGroups = undefined;
    let filterExcludeRigidBody = rigidBody as any;

    let hit = this.physicsWorld!.castRay(
      ray,
      maxToi,
      solid,
      filterFlags,
      filterGroups,
      filterExcludeRigidBody
    );

    return hit != null;
  }

  setLinearVelocity(rigidBody: RAPIER.RigidBody, velocity: Vector3 | Vector3) {
    rigidBody.setLinvel(velocity, true);
  }

  createTrimesh(
    position: Vector3,
    rotation: Quaternion,
    vertices: Float32Array,
    indices: Uint32Array
  ) {
    const rbDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(position.x, position.y, position.z)
      .setRotation({
        w: rotation.w,
        x: rotation.x,
        y: rotation.y,
        z: rotation.z,
      });

    const rigidBody = this.physicsWorld!.createRigidBody(rbDesc);

    const colDesc = RAPIER.ColliderDesc.trimesh(vertices, indices);

    const collider = this.physicsWorld!.createCollider(colDesc, rigidBody);

    return { rigidBody, collider };
  }

  createCar(position: Vector3): PhysicsObject {
    let rbDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setAdditionalMass(1500);
    let rigidBody = this.physicsWorld!.createRigidBody(rbDesc);

    let boxColDesc = RAPIER.ColliderDesc.cuboid(1, 0.25, 2.5);
    let collider = this.physicsWorld!.createCollider(boxColDesc, rigidBody);

    return { rigidBody, collider };
  }

  setTranslation(physicsObject: PhysicsObject, vec: Vector3) {
    physicsObject.rigidBody.setTranslation(vec, true);
  }

  raycastFull(origin: Vector3, dir: Vector3, rb: any, toi: number = 4) {
    ray.origin = origin;
    ray.dir = dir;

    let maxToi = toi;
    let solid = false;

    let hit = this.physicsWorld!.castRay(
      ray,
      maxToi,
      solid,
      undefined,
      undefined,
      undefined,
      rb
    );

    return { ray, hit };
  }

  remove(physicsObject: PhysicsObject) {
    this.physicsWorld!.removeRigidBody(physicsObject.rigidBody);
    this.physicsWorld!.removeCollider(physicsObject.collider, true);
  }

  clear() {
    if (this.physicsWorld) {
      this.physicsWorld.free();
      this.physicsWorld = null;
    }
  }

  update() {
    if (!this.physicsIsReady) {
      return;
    }
    this.physicsWorld!.step();
  }
}
