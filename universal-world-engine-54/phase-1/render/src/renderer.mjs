// renderer.mjs - Shared renderer for UWE54 Phase 1.
// Pinned Three.js r149, passed in as the UMD global THREE. Never imports three.
// WebGLRenderer, antialias false, pixel ratio capped at 1, no shadows
// (SwiftShader baseline). Clear color obsidian #05070A.
// No em dashes in this file.
export function createRenderer(THREE, canvas, opts) {
  opts = opts || {};
  if (!THREE) throw new Error("createRenderer: THREE global is required");
  if (!canvas) throw new Error("createRenderer: canvas is required");
  if (typeof THREE.REVISION !== "string") throw new Error("createRenderer: THREE.REVISION missing");

  const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: false,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1));
  renderer.shadowMap.enabled = false;
  renderer.setClearColor(0x05070a, 1);

  const gl = renderer.getContext();
  let contextVersion = "unknown";
  let isWebGL2 = false;
  if (gl) {
    try {
      const ver = gl.getParameter(gl.VERSION);
      contextVersion = String(ver);
      isWebGL2 = contextVersion.indexOf("WebGL 2.0") === 0;
    } catch (e) {
      contextVersion = "unavailable (" + e.message + ")";
    }
  }
  if (!gl) contextVersion = "no WebGL context available";

  const webgpu = {
    present: (typeof navigator !== "undefined" && !!navigator.gpu),
    measuredWorking: false,
    note: "navigator.gpu presence only; WebGPU is NOT claimed working until measured working",
  };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070a);
  if (opts.fog) {
    scene.fog = new THREE.Fog(0x05070a, 180, 420);
  }

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  const target = new THREE.Vector3(0, 12, 0);
  const orbit = {
    theta: 0,
    phi: 1.02,
    radius: 155,
    target: target,
    minRadius: 40,
    maxRadius: 600,
    minPhi: 0.25,
    maxPhi: 1.45,
    autoFit: true,
  };

  function applyCamera() {
    const aspect = canvas.clientWidth && canvas.clientHeight
      ? canvas.clientWidth / canvas.clientHeight
      : 16 / 9;
    camera.aspect = aspect;
    // Initial framing must show the whole district at both viewports.
    // On narrow screens the horizontal field of view shrinks, so fit the
    // district width (half-width about 100 units) before the user zooms.
    // autoFit turns off the moment the user zooms or orbits by wheel,
    // pinch, drag, or the zoom buttons.
    if (orbit.autoFit && aspect < 1.2) {
      const tanHalfHfov = Math.tan((camera.fov * Math.PI / 180) / 2) * aspect;
      const fitDist = 100 / tanHalfHfov + 40;
      if (orbit.radius < fitDist) orbit.radius = Math.min(fitDist, orbit.maxRadius);
    }
    const sp = Math.sin(orbit.phi);
    camera.position.set(
      target.x + orbit.radius * sp * Math.sin(orbit.theta),
      target.y + orbit.radius * Math.cos(orbit.phi),
      target.z + orbit.radius * sp * Math.cos(orbit.theta)
    );
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }

  function resize() {
    const w = canvas.clientWidth || canvas.width || 1280;
    const h = canvas.clientHeight || canvas.height || 720;
    renderer.setSize(w, h, false);
    applyCamera();
  }

  if (typeof ResizeObserver !== "undefined" && canvas.parentElement) {
    const ro = new ResizeObserver(function () { resize(); });
    ro.observe(canvas.parentElement);
  }
  if (typeof window !== "undefined") {
    window.addEventListener("resize", resize);
  }
  resize();

  // Orbit controls: drag to orbit, wheel to zoom, touch pinch.
  const pointers = new Map();
  let pinchStart = 0;
  let lastX = 0;
  let lastY = 0;
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", function (ev) {
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    lastX = ev.clientX;
    lastY = ev.clientY;
    if (pointers.size === 2) {
      const pts = Array.from(pointers.values());
      pinchStart = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
    try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
  });
  canvas.addEventListener("pointermove", function (ev) {
    if (!pointers.has(ev.pointerId)) return;
    if (pointers.size === 2) {
      pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      const pts = Array.from(pointers.values());
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinchStart > 0 && d > 0) {
        orbit.autoFit = false;
        orbit.radius = Math.min(orbit.maxRadius, Math.max(orbit.minRadius, orbit.radius * (pinchStart / d)));
        pinchStart = d;
        applyCamera();
      }
      return;
    }
    const dx = ev.clientX - lastX;
    const dy = ev.clientY - lastY;
    lastX = ev.clientX;
    lastY = ev.clientY;
    orbit.autoFit = false;
    orbit.theta -= dx * 0.005;
    orbit.phi = Math.min(orbit.maxPhi, Math.max(orbit.minPhi, orbit.phi - dy * 0.005));
    applyCamera();
  });
  function endPointer(ev) {
    pointers.delete(ev.pointerId);
    if (pointers.size < 2) pinchStart = 0;
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("wheel", function (ev) {
    ev.preventDefault();
    orbit.autoFit = false;
    orbit.radius = Math.min(orbit.maxRadius, Math.max(orbit.minRadius, orbit.radius * (1 + Math.sign(ev.deltaY) * 0.08)));
    applyCamera();
  }, { passive: false });

  function zoomIn() {
    orbit.autoFit = false;
    orbit.radius = Math.max(orbit.minRadius, orbit.radius * 0.85);
    applyCamera();
  }
  function zoomOut() {
    orbit.autoFit = false;
    orbit.radius = Math.min(orbit.maxRadius, orbit.radius * 1.18);
    applyCamera();
  }

  function frameStats() {
    const info = renderer.info.render;
    return { drawCalls: info.calls, triangles: info.triangles, geometries: info.geometries, textures: info.textures };
  }
  function render() {
    renderer.render(scene, camera);
    return frameStats();
  }
  function resetStats() {
    if (renderer.info && typeof renderer.info.reset === "function") renderer.info.reset();
  }

  applyCamera();

  return {
    renderer: renderer,
    scene: scene,
    camera: camera,
    orbit: orbit,
    threeRevision: THREE.REVISION,
    contextVersion: contextVersion,
    isWebGL2: isWebGL2,
    webgpu: webgpu,
    clearColor: "#05070A",
    antialias: false,
    pixelRatioCappedAt: 1,
    shadowsEnabled: false,
    applyCamera: applyCamera,
    resize: resize,
    render: render,
    frameStats: frameStats,
    resetStats: resetStats,
    zoomIn: zoomIn,
    zoomOut: zoomOut,
  };
}
