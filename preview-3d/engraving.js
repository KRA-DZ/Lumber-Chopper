import * as THREE from "./vendor/three.module.min.js";

export const normalizeStyle = (value) =>
  value === "engraving" ? "engraving" : "lowpoly";
export function engravingSize(width, height, low) {
  const scale = Math.min(1, (low ? 900 : 1400) / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

const fragmentShader = /* glsl */ `
  uniform sampler2D source;
  uniform vec2 resolution;
  uniform float night;
  uniform float exposure;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec3 tone(vec3 c) {
    c *= exposure;
    c = clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0);
    return pow(c, vec3(1.0 / 2.2));
  }
  vec3 sampleColor(vec2 p) { return tone(texture2D(source, p).rgb); }
  float inkLuma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
  float lum(vec2 offset) { return inkLuma(sampleColor(vUv + offset / resolution)); }
  float stroke(float phase, float width) {
    float wave = abs(sin(phase));
    return 1.0 - smoothstep(width, width + 0.16, wave);
  }
  void main() {
    vec3 original = sampleColor(vUv);
    float lightness = inkLuma(original);
    vec2 p = vUv * resolution;
    float grain = hash(floor(p));
    float broadGrain = hash(floor(p / 3.0));
    float left = lum(vec2(-1.0, 0.0)), right = lum(vec2(1.0, 0.0));
    float above = lum(vec2(0.0, 1.0)), below = lum(vec2(0.0, -1.0));
    float edge = length(vec2(right - left, above - below));
    float outlines = smoothstep(0.045, 0.22, edge);
    float shadow = clamp((0.88 - lightness) * 1.65, 0.0, 1.0);
    float wobble = sin(p.y * 0.031) * 0.7 + sin(p.x * 0.019) * 0.55;
    float line1 = stroke((p.x + p.y * 1.25) * 0.72 + wobble, 0.17);
    float line2 = stroke((p.x - p.y * 1.15) * 0.66 - wobble, 0.13);
    float line3 = stroke(p.y * 1.1 + sin(p.x * 0.055) * 1.4, 0.1);
    float hatch = line1 * smoothstep(0.1, 0.43, shadow);
    hatch = max(hatch, line2 * smoothstep(0.35, 0.69, shadow));
    hatch = max(hatch, line3 * smoothstep(0.67, 0.96, shadow));
    hatch *= 0.75 + broadGrain * 0.25;

    vec3 paper = vec3(0.83, 0.765, 0.575) * (1.0 - night * 0.23);
    vec3 ink = vec3(0.09, 0.115, 0.09);
    float wash = smoothstep(0.07, 0.93, lightness);
    vec3 color = mix(ink, paper, 0.27 + wash * 0.73);
    color = mix(color, original * vec3(0.94, 0.91, 0.76), 0.16);
    float inkAmount = max(hatch * (0.5 + shadow * 0.26), outlines * 0.92);
    color = mix(color, ink, inkAmount);
    color *= 0.96 + grain * 0.065;
    color += (broadGrain - 0.5) * 0.025;

    // Огонь, фонари и светящиеся знаки сохраняют акценты среди чернил.
    float warmth = smoothstep(0.07, 0.25, original.r - original.b) * smoothstep(0.7, 0.95, original.r);
    vec3 ember = mix(color, original * vec3(1.0, 0.91, 0.65), 0.65);
    color = mix(color, ember, warmth);
    float vignette = (1.0 - smoothstep(0.18, 0.9, length((vUv - 0.5) * vec2(1.0, 0.85))));
    color *= 0.88 + vignette * 0.12;
    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`;

// Один дополнительный проход; материалам/моделям и игровым правилам стиль не мешает.
// При возвращении в low-poly буфер освобождается, обычный рендер остаётся прямым.
export function createEngraving(renderer, draw) {
  const scene = new THREE.Scene(),
    camera = new THREE.Camera();
  const size = new THREE.Vector2();
  const floating = renderer.extensions.has("EXT_color_buffer_float");
  const uniforms = {
    source: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    night: { value: 0 },
    exposure: { value: renderer.toneMappingExposure },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader:
      "varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  scene.add(quad);
  let enabled = false,
    low = false,
    target = null;
  function release() {
    target?.dispose();
    target = null;
    uniforms.source.value = null;
  }
  function render(world, view) {
    if (!enabled) {
      draw(world, view);
      return;
    }
    renderer.getDrawingBufferSize(size);
    const next = engravingSize(size.x, size.y, low);
    if (!target) {
      target = new THREE.WebGLRenderTarget(next.width, next.height, {
        type: floating ? THREE.HalfFloatType : THREE.UnsignedByteType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: true,
        stencilBuffer: false,
      });
      target.texture.colorSpace = THREE.LinearSRGBColorSpace;
      uniforms.source.value = target.texture;
    } else if (target.width !== next.width || target.height !== next.height)
      target.setSize(next.width, next.height);
    uniforms.resolution.value.set(next.width, next.height);
    const previous = renderer.getRenderTarget();
    try {
      renderer.setRenderTarget(target);
      draw(world, view);
      const counts = renderer.info ? { ...renderer.info.render } : null;
      renderer.setRenderTarget(previous);
      draw(scene, camera);
      if (counts)
        for (const key of ["calls", "triangles", "points", "lines"])
          renderer.info.render[key] += counts[key];
    } finally {
      renderer.setRenderTarget(previous);
    }
  }
  return {
    render,
    setEnabled(value) {
      enabled = Boolean(value);
      if (!enabled) release();
    },
    setLow(value) {
      low = Boolean(value);
    },
    setNight(value) {
      uniforms.night.value = value;
    },
    get enabled() {
      return enabled;
    },
    get target() {
      return target;
    },
  };
}
