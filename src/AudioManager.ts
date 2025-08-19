import * as THREE from "three";

const audioList = [
  { key: "huh_1", url: "audio/huh_1.mp3" },
  { key: "whoosh_1", url: "audio/whoosh/1.mp3" },
  { key: "whoosh_2", url: "audio/whoosh/2.mp3" },
  { key: "whoosh_3", url: "audio/whoosh/3.mp3" },
  { key: "pickup", url: "audio/pickup.mp3" },
  { key: "punch_impact", url: "audio/punch_impact.mp3" },
  { key: "horn", url: "audio/horn.mp3" },
];

export default class AudioManager {
  public static _instance: AudioManager;

  private audioBuffers: Map<string, AudioBuffer> = new Map();
  private audios: Map<string, THREE.Audio> = new Map();
  private listener: THREE.AudioListener;

  private constructor() {
    this.listener = new THREE.AudioListener();
  }

  public static get instance(): AudioManager {
    if (!this._instance) {
      this._instance = new AudioManager();
    }
    return this._instance;
  }

  attachToCamera(camera: THREE.Camera) {
    camera.add(this.listener);
  }

  getListener() {
    return this.listener;
  }

  getBufferByName(name: string): AudioBuffer | undefined {
    return this.audioBuffers.get(name);
  }

  async loadAll(): Promise<void> {
    await Promise.all(
      audioList.map((audio) => this.loadAudio(audio.url, audio.key))
    );
  }

  private loadAudio(url: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const loader = new THREE.AudioLoader();
      loader.load(
        url,
        (buffer) => {
          this.audioBuffers.set(key, buffer);
          resolve();
        },
        undefined,
        reject
      );
    });
  }

  playAudio(key: string, volume: number = 1) {
    const buffer = this.audioBuffers.get(key);
    if (!buffer) return;

    let sound = this.audios.get(key);
    if (!sound) {
      sound = new THREE.Audio(this.listener);
      sound.setBuffer(buffer);
      this.audios.set(key, sound);
    }

    if (sound.isPlaying) sound.stop();
    sound.setVolume(volume);
    sound.play();
  }
}
