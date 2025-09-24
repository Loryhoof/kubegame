import * as THREE from "three";

// GLSL simplex noise (fast 2D)
const snoise2D = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187,0.366025403784439,
                     -0.577350269189626,0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute( permute(i.y + vec3(0.0,i1.y,1.0))
      + i.x + vec3(0.0,i1.x,1.0));
  vec3 x = fract(p * C.w) * 2.0 - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  vec2 g0 = vec2(a0.x,h.x);
  vec2 g1 = vec2(a0.y,h.y);
  vec2 g2 = vec2(a0.z,h.z);
  float t0 = 0.5 - dot(x0,x0);
  float t1 = 0.5 - dot(x12.xy,x12.xy);
  float t2 = 0.5 - dot(x12.zw,x12.zw);
  float n0 = t0<0.0?0.0:pow(t0,4.0)*dot(g0,x0);
  float n1 = t1<0.0?0.0:pow(t1,4.0)*dot(g1,x12.xy);
  float n2 = t2<0.0?0.0:pow(t2,4.0)*dot(g2,x12.zw);
  return 70.0*(n0+n1+n2);
}
`;

export function createSandMaterial(baseColor = 0xf7d299) {
  return new THREE.ShaderMaterial({
    uniforms: {
      baseColor: { value: new THREE.Color(baseColor) },
      fogColor: { value: new THREE.Color(0xf7d299) },
      fogNear: { value: 30 },
      fogFar: { value: 200 },
      lightDir: { value: new THREE.Vector3(0.3, 1.0, 0.4).normalize() },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main() {
        vWorldPos = (modelMatrix * vec4(position,1.0)).xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 baseColor;
      uniform vec3 fogColor;
      uniform float fogNear;
      uniform float fogFar;
      uniform vec3 lightDir;

      varying vec3 vWorldPos;
      varying vec3 vNormal;

      ${snoise2D}

      void main() {
        // Larger dune patterns
        float dunes = snoise(vWorldPos.xz * 0.03) * 0.8;

        // Smaller grain patterns
        float grains = snoise(vWorldPos.xz * 3.0) * 0.2;

        // Combine and normalize to [-1,1]
        float noise = dunes + grains;

        // Perturb normals for shading
        vec3 perturbedNormal = normalize(vNormal + vec3(noise*0.3, noise*0.15, noise*0.3));

        // Diffuse lighting
        float NdotL = clamp(dot(perturbedNormal, normalize(lightDir)), 0.0, 1.0);

        // Darker / lighter modulation
        float shade = 0.8 + noise * 0.5; // strong contrast
        vec3 color = baseColor * shade;

        // Apply lighting
        color *= (0.5 + 0.6 * NdotL);

        // Fog
        float dist = length(vWorldPos);
        float f = smoothstep(fogNear, fogFar, dist);
        // color = mix(color, fogColor, f);

        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.FrontSide,
    fog: true,
  });
}
