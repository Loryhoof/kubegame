import { Vector3 } from "three";

export const INPUT_BITS = {
  moveForward: 1 << 0,
  moveBackward: 1 << 1,
  moveLeft: 1 << 2,
  moveRight: 1 << 3,
  jump: 1 << 4,
  sprint: 1 << 5,
  interact: 1 << 6,
  reload: 1 << 7,
  shoot: 1 << 8,
  aim: 1 << 9,
  spawnVehicle: 1 << 10,
  useHorn: 1 << 11,
  slot1: 1 << 12,
  slot2: 1 << 13,
  slot3: 1 << 14,
  slot4: 1 << 15,
} as const;

export type InputKey = keyof typeof INPUT_BITS;

export function encodeKeys(keys: Record<InputKey, boolean>): number {
  let mask = 0;
  (Object.keys(INPUT_BITS) as InputKey[]).forEach((key) => {
    if (keys[key]) mask |= INPUT_BITS[key];
  });
  return mask;
}

export function decodeKeys(mask: number): Record<InputKey, boolean> {
  const result = {} as Record<InputKey, boolean>;

  // Always populate all keys
  (Object.keys(INPUT_BITS) as InputKey[]).forEach((key) => {
    result[key] = (mask & INPUT_BITS[key]) !== 0;
  });

  return result;
}

export function deserializeBinaryWorld(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  let offset = 0;

  // ---- TIME ----
  const time = view.getFloat64(offset);
  offset += 8;

  // ---- PLAYERS ----
  const playerCount = view.getUint16(offset);
  offset += 2;
  const players: Record<string, any> = {};

  for (let i = 0; i < playerCount; i++) {
    const idLength = view.getUint8(offset++);
    const id = new TextDecoder().decode(
      new Uint8Array(buffer, offset, idLength)
    );
    offset += idLength;

    const px = view.getFloat32(offset);
    offset += 4;
    const py = view.getFloat32(offset);
    offset += 4;
    const pz = view.getFloat32(offset);
    offset += 4;

    const qx = view.getFloat32(offset);
    offset += 4;
    const qy = view.getFloat32(offset);
    offset += 4;
    const qz = view.getFloat32(offset);
    offset += 4;
    const qw = view.getFloat32(offset);
    offset += 4;

    const vx = view.getFloat32(offset);
    offset += 4;
    const vy = view.getFloat32(offset);
    offset += 4;
    const vz = view.getFloat32(offset);
    offset += 4;

    const vqx = view.getFloat32(offset);
    offset += 4;
    const vqy = view.getFloat32(offset);
    offset += 4;
    const vqz = view.getFloat32(offset);
    offset += 4;
    const vqw = view.getFloat32(offset);
    offset += 4;

    const keyMask = view.getUint16(offset);
    offset += 2;
    const seq = view.getUint16(offset);
    offset += 2;

    players[id] = {
      id,
      position: { x: px, y: py, z: pz },
      quaternion: { x: qx, y: qy, z: qz, w: qw },
      velocity: { x: vx, y: vy, z: vz },
      viewQuaternion: { x: vqx, y: vqy, z: vqz, w: vqw },
      keys: decodeKeys(keyMask),
      lastProcessedInputSeq: seq,
    };
  }

  // ---- VEHICLES ----
  const vehicleCount = view.getUint16(offset);
  offset += 2;
  const vehicles: any[] = [];

  for (let i = 0; i < vehicleCount; i++) {
    const idLength = view.getUint8(offset++);
    const id = new TextDecoder().decode(
      new Uint8Array(buffer, offset, idLength)
    );
    offset += idLength;

    const px = view.getFloat32(offset);
    offset += 4;
    const py = view.getFloat32(offset);
    offset += 4;
    const pz = view.getFloat32(offset);
    offset += 4;

    const qx = view.getFloat32(offset);
    offset += 4;
    const qy = view.getFloat32(offset);
    offset += 4;
    const qz = view.getFloat32(offset);
    offset += 4;
    const qw = view.getFloat32(offset);
    offset += 4;

    const lvx = view.getFloat32(offset);
    offset += 4;
    const lvy = view.getFloat32(offset);
    offset += 4;
    const lvz = view.getFloat32(offset);
    offset += 4;

    const avx = view.getFloat32(offset);
    offset += 4;
    const avy = view.getFloat32(offset);
    offset += 4;
    const avz = view.getFloat32(offset);
    offset += 4;

    const hornPlaying = !!view.getUint8(offset++);

    // ---- WHEELS ----
    const wheelCount = view.getUint8(offset++);
    const wheels: any[] = [];
    for (let j = 0; j < wheelCount; j++) {
      const wx = view.getFloat32(offset);
      offset += 4;
      const wy = view.getFloat32(offset);
      offset += 4;
      const wz = view.getFloat32(offset);
      offset += 4;
      const wqx = view.getFloat32(offset);
      offset += 4;
      const wqy = view.getFloat32(offset);
      offset += 4;
      const wqz = view.getFloat32(offset);
      offset += 4;
      const wqw = view.getFloat32(offset);
      offset += 4;
      wheels.push({
        worldPosition: { x: wx, y: wy, z: wz },
        quaternion: { x: wqx, y: wqy, z: wqz, w: wqw },
      });
    }

    // ---- SEATS ----
    const seatCount = view.getUint8(offset++);
    const seats: any[] = [];

    for (let j = 0; j < seatCount; j++) {
      const idLength = view.getUint8(offset++);
      let seaterId: string | null = null;

      if (idLength > 0) {
        const idBytes = new Uint8Array(buffer, offset, idLength);
        seaterId = new TextDecoder().decode(idBytes);
        offset += idLength;
      }

      const sx = view.getFloat32(offset);
      offset += 4;
      const sy = view.getFloat32(offset);
      offset += 4;
      const sz = view.getFloat32(offset);
      offset += 4;

      seats.push({
        seater: seaterId,
        position: { x: sx, y: sy, z: sz },
      });
    }

    const lastProcessedInputSeq = view.getUint16(offset);
    offset += 2;

    vehicles.push({
      id,
      position: { x: px, y: py, z: pz },
      quaternion: { x: qx, y: qy, z: qz, w: qw },
      linearVelocity: { x: lvx, y: lvy, z: lvz },
      angularVelocity: { x: avx, y: avy, z: avz },
      hornPlaying,
      wheels,
      seats,
      lastProcessedInputSeq,
    });
  }

  // ---- NPCS ----
  const npcCount = view.getUint16(offset);
  offset += 2;
  const npcs: any[] = [];

  for (let i = 0; i < npcCount; i++) {
    const idLength = view.getUint8(offset++);
    const id = new TextDecoder().decode(
      new Uint8Array(buffer, offset, idLength)
    );
    offset += idLength;

    const px = view.getFloat32(offset);
    offset += 4;
    const py = view.getFloat32(offset);
    offset += 4;
    const pz = view.getFloat32(offset);
    offset += 4;

    const qx = view.getFloat32(offset);
    offset += 4;
    const qy = view.getFloat32(offset);
    offset += 4;
    const qz = view.getFloat32(offset);
    offset += 4;
    const qw = view.getFloat32(offset);
    offset += 4;

    const vx = view.getFloat32(offset);
    offset += 4;
    const vy = view.getFloat32(offset);
    offset += 4;
    const vz = view.getFloat32(offset);
    offset += 4;

    const vqx = view.getFloat32(offset);
    offset += 4;
    const vqy = view.getFloat32(offset);
    offset += 4;
    const vqz = view.getFloat32(offset);
    offset += 4;
    const vqw = view.getFloat32(offset);
    offset += 4;

    const keyMask = view.getUint16(offset);
    offset += 2;

    npcs.push({
      id,
      position: { x: px, y: py, z: pz },
      quaternion: { x: qx, y: qy, z: qz, w: qw },
      velocity: { x: vx, y: vy, z: vz },
      viewQuaternion: { x: vqx, y: vqy, z: vqz, w: vqw },
      keys: decodeKeys(keyMask),
    });
  }

  return { time, players, vehicles, npcs };
}

export function deserializeBinaryPlayers(arrayBuffer: ArrayBuffer) {
  const view = new DataView(arrayBuffer);
  let offset = 0;

  const playerCount = view.getUint16(offset);
  offset += 2;

  const players: any[] = [];

  for (let i = 0; i < playerCount; i++) {
    // --- ID ---
    const idLength = view.getUint8(offset++);
    const idBytes = new Uint8Array(arrayBuffer, offset, idLength);
    const id = new TextDecoder().decode(idBytes);
    offset += idLength;

    // --- POSITION ---
    const px = view.getFloat32(offset);
    offset += 4;
    const py = view.getFloat32(offset);
    offset += 4;
    const pz = view.getFloat32(offset);
    offset += 4;

    // --- ROTATION QUATERNION ---
    const qx = view.getFloat32(offset);
    offset += 4;
    const qy = view.getFloat32(offset);
    offset += 4;
    const qz = view.getFloat32(offset);
    offset += 4;
    const qw = view.getFloat32(offset);
    offset += 4;

    // --- VELOCITY ---
    const vx = view.getFloat32(offset);
    offset += 4;
    const vy = view.getFloat32(offset);
    offset += 4;
    const vz = view.getFloat32(offset);
    offset += 4;

    // --- IS DEAD (Uint8) ---
    const isDead = view.getUint8(offset);
    offset += 1;

    // --- KEYMASK ---
    const keyMask = view.getUint16(offset);
    offset += 2;

    // --- LAST PROCESSED INPUT SEQ ---
    const lastSeq = view.getUint16(offset);
    offset += 2;

    // --- VIEW QUATERNION ---
    const vqx = view.getFloat32(offset);
    offset += 4;
    const vqy = view.getFloat32(offset);
    offset += 4;
    const vqz = view.getFloat32(offset);
    offset += 4;
    const vqw = view.getFloat32(offset);
    offset += 4;

    // Push into result array
    players.push({
      id,
      position: { x: px, y: py, z: pz },
      quaternion: { x: qx, y: qy, z: qz, w: qw },
      velocity: { x: vx, y: vy, z: vz },
      isDead: isDead === 1,
      keys: decodeKeys(keyMask),
      lastProcessedInputSeq: lastSeq,
      viewQuaternion: { x: vqx, y: vqy, z: vqz, w: vqw },
    });
  }

  return players;
}

export function deserializePlayer(data: any) {
  return {
    id: data.i,
    position: {
      x: data.p[0],
      y: data.p[1],
      z: data.p[2],
    },
    quaternion: {
      x: data.q[0],
      y: data.q[1],
      z: data.q[2],
      w: data.q[3],
    },
    velocity: {
      x: data.v[0],
      y: data.v[1],
      z: data.v[2],
    },
    keys: decodeKeys(data.k),
    lastProcessedInputSeq: data.s,
    viewQuaternion: {
      x: data.vq[0],
      y: data.vq[1],
      z: data.vq[2],
      w: data.vq[3],
    },
  };
}

export function serializeBinaryPlayerInput(input: any): ArrayBuffer {
  // Structure:
  // 0–1   uint16 action bitmask
  // 2–3   uint16 sequence number
  // 4     uint8  dt (0–255, quantized)
  // 5–20  float32[4] camera quaternion
  // 21–32 float32[3] camera position

  const buffer = new ArrayBuffer(33);
  const view = new DataView(buffer);
  let offset = 0;

  // --- Action Bitmask ---
  const mask = encodeKeys(input.actions);
  view.setUint16(offset, mask);
  offset += 2;

  // --- Sequence ---
  view.setUint16(offset, input.seq);
  offset += 2;

  // --- dt (quantized to milliseconds * 255 max) ---
  const dtByte = Math.min(Math.round(input.dt * 255), 255);
  view.setUint8(offset, dtByte);
  offset += 1;

  // --- camQuat ---
  const q = Array.isArray(input.camQuat)
    ? input.camQuat
    : [input.camQuat.x, input.camQuat.y, input.camQuat.z, input.camQuat.w];
  for (let i = 0; i < 4; i++) {
    view.setFloat32(offset, q[i]);
    offset += 4;
  }

  // --- camPos ---
  const p =
    input.camPos instanceof Vector3
      ? [input.camPos.x, input.camPos.y, input.camPos.z]
      : [input.camPos.x, input.camPos.y, input.camPos.z];
  for (let i = 0; i < 3; i++) {
    view.setFloat32(offset, p[i]);
    offset += 4;
  }

  return buffer;
}
