// ClientSky.ts
import * as THREE from "three";

export default class ClientSky {
  public mesh: THREE.Mesh;

  constructor(radius = 5000) {
    const skyVertexShader = `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const skyFragmentShader = `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + offset).y;
        float mixFactor = max(pow(max(h, 0.0), exponent), 0.0);
        gl_FragColor = vec4(mix(bottomColor, topColor, mixFactor), 1.0);
      }
    `;

    const skyUniforms = {
      topColor: { value: new THREE.Color(0xbddbff) }, // bluish zenith
      bottomColor: { value: new THREE.Color(0xffffff) }, // white horizon
      offset: { value: 33 },
      exponent: { value: 0.6 },
    };

    const skyMaterial = new THREE.ShaderMaterial({
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
      uniforms: skyUniforms,
      side: THREE.BackSide,
      fog: false,
    });

    const skyGeometry = new THREE.SphereGeometry(radius, 32, 32);
    this.mesh = new THREE.Mesh(skyGeometry, skyMaterial);
  }
}
