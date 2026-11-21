// district.mjs - HERMES CITY district builder for UWE54 Phase 1.
// Builds the 11 ACTUAL towers from the live HERMES CITY layout
// (evidence/hermes-city-layout-6ead8bb7.json, main 6ead8bb7) as procedural
// DEVELOPMENT MODE geometry. This is not final art. Positions, heights,
// widths, depths, signs and accents come from LAYOUT; map percentages
// and tags come from DISTRICTS.
// Agent render positions are RENDER-ONLY: base position per agent is a
// deterministic offset from a RENDER-ONLY PRNG mulberry32(54000 + index).
// The sim rng and sim state are never used here. Per-tick visual bob is
// a pure function of (tick, index), so it is deterministic and
// interpolatable. The renderer owns the pos/prev ECS arrays; the sim
// never touches them.
// No em dashes in this file.
import { mulberry32 } from "../../engine/src/prng.mjs";
import { AGENT_STATE_NAMES } from "../../ecs/src/components.mjs";

export const DISTRICT_CENTERS = {
  "ATG": { x: -78, z: -20, spreadX: 14, spreadZ: 14 },
  "DOCKING": { x: 78, z: -20, spreadX: 14, spreadZ: 14 },
  "HERMES-CITY": { x: 0, z: 0, spreadX: 55, spreadZ: 48 },
  "AQUADUCT": { x: 0, z: 68, spreadX: 16, spreadZ: 10 },
};

export const AGENT_COLORS = {
  NORMAL: 0x00e5ff,
  SUSPECT: 0xffb300,
  QUARANTINED: 0xff2638,
  FORENSIC_HOLD: 0xff7a00,
  REMEDIATED: 0x7dff9a,
  REAUTHORIZED: 0x9aa7b8,
};

export function agentColorForState(stateIndex) {
  const name = AGENT_STATE_NAMES[stateIndex] || "NORMAL";
  return AGENT_COLORS[name] !== undefined ? AGENT_COLORS[name] : 0x8899aa;
}

export function bobOffset(tick, index) {
  return {
    x: 0.35 * Math.cos(tick * 0.06 + index * 0.7),
    y: 0.25 * Math.sin(tick * 0.12 + index * 0.9),
    z: 0.35 * Math.sin(tick * 0.05 + index * 1.3),
  };
}

export function basePositionForAgent(index, districtName) {
  const c = DISTRICT_CENTERS[districtName] || DISTRICT_CENTERS["HERMES-CITY"];
  const rng = mulberry32(54000 + index);
  return {
    x: c.x + (rng() * 2 - 1) * c.spreadX,
    y: 1.0,
    z: c.z + (rng() * 2 - 1) * c.spreadZ,
  };
}

function makeLabel(THREE, text, accentHex) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(5,7,10,0.82)";
  ctx.fillRect(0, 0, 512, 96);
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 508, 92);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 44px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(22, 4.1, 1);
  return sprite;
}

function edgeLines(THREE, mesh, accent) {
  const edges = new THREE.EdgesGeometry(mesh.geometry);
  const lines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: accent }));
  mesh.add(lines);
  return lines;
}

function box(THREE, group, w, h, d, x, y, z, color, accent) {
  const mat = new THREE.MeshLambertMaterial({ color: color });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  if (accent !== undefined) edgeLines(THREE, mesh, accent);
  group.add(mesh);
  return mesh;
}

export function buildDistrict(THREE, layoutData) {
  if (!THREE) throw new Error("buildDistrict: THREE global is required");
  if (!layoutData || !Array.isArray(layoutData.towers)) {
    throw new Error("buildDistrict: layoutData.towers array is required");
  }
  const group = new THREE.Group();
  group.name = "hermes-city-district-development-mode";

  const groundMat = new THREE.MeshLambertMaterial({ color: 0x0b1118 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(190, 170), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  group.add(ground);
  const grid = new THREE.GridHelper(180, 36, 0x00e5ff, 0x1c2a3a);
  grid.position.y = 0.05;
  grid.material.transparent = true;
  grid.material.opacity = 0.35;
  group.add(grid);

  const towers = [];
  const bodyColor = 0x1a2433;
  for (const t of layoutData.towers) {
    const tg = new THREE.Group();
    tg.name = "tower-" + t.id;
    tg.position.set(t.x, 0, t.z);
    const accent = t.accent;
    const w = t.w;
    const d = t.d;
    const h = t.h;
    const accentCss = "#" + accent.toString(16).padStart(6, "0");
    if (t.id === "hermes-hq") {
      // Stepped spire: stacked shrinking boxes.
      const steps = 5;
      for (let i = 0; i < steps; i++) {
        const f = 1 - (i * 0.16);
        const sh = h / steps;
        box(THREE, tg, w * f, sh, d * f, 0, sh * (i + 0.5), 0, bodyColor, accent);
      }
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(2.2, 6, 4),
        new THREE.MeshLambertMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.7 })
      );
      tip.position.set(0, h + 3, 0);
      tip.rotation.y = Math.PI / 4;
      tg.add(tip);
    } else if (t.id === "mission-control") {
      // Wide ops block plus dish: flattened sphere on roof.
      box(THREE, tg, w, h, d, 0, h / 2, 0, bodyColor, accent);
      const dish = new THREE.Mesh(
        new THREE.SphereGeometry(5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshLambertMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.4 })
      );
      dish.scale.set(1, 0.45, 1);
      dish.position.set(0, h, 0);
      tg.add(dish);
      box(THREE, tg, 1, 4, 1, 4, h + 2, 0, bodyColor, accent);
    } else if (t.id === "nemoclaw-works") {
      // Twin slabs plus sky bridge.
      box(THREE, tg, w * 0.42, h, d, -w * 0.28, h / 2, 0, bodyColor, accent);
      box(THREE, tg, w * 0.42, h * 0.85, d, w * 0.28, (h * 0.85) / 2, 0, bodyColor, accent);
      box(THREE, tg, w * 0.7, 2.5, d * 0.6, 0, h * 0.72, 0, bodyColor, accent);
    } else if (t.id === "nemotron-council") {
      // Round council dome: cylinder plus sphere half.
      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(w / 2, w / 2, h * 0.55, 24),
        new THREE.MeshLambertMaterial({ color: bodyColor })
      );
      cyl.position.set(0, (h * 0.55) / 2, 0);
      edgeLines(THREE, cyl, accent);
      tg.add(cyl);
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(w / 2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshLambertMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.25 })
      );
      dome.position.set(0, h * 0.55, 0);
      tg.add(dome);
    } else if (t.id === "visual-compute") {
      // Portal screen frame: box frame plus emissive screen plane.
      box(THREE, tg, 2.5, h, d, -w / 2, h / 2, 0, bodyColor, accent);
      box(THREE, tg, 2.5, h, d, w / 2, h / 2, 0, bodyColor, accent);
      box(THREE, tg, w, 2.5, d, 0, h - 1.2, 0, bodyColor, accent);
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(w - 5, h - 5),
        new THREE.MeshBasicMaterial({ color: accent })
      );
      screen.position.set(0, h / 2, d / 2 + 0.1);
      tg.add(screen);
    } else if (t.id === "wallet-rails") {
      // Low vault plus 4 corner posts.
      box(THREE, tg, w, h, d, 0, h / 2, 0, bodyColor, accent);
      const px = w / 2 - 1;
      const pz = d / 2 - 1;
      box(THREE, tg, 1.6, h + 4, 1.6, -px, (h + 4) / 2, -pz, bodyColor, accent);
      box(THREE, tg, 1.6, h + 4, 1.6, px, (h + 4) / 2, -pz, bodyColor, accent);
      box(THREE, tg, 1.6, h + 4, 1.6, -px, (h + 4) / 2, pz, bodyColor, accent);
      box(THREE, tg, 1.6, h + 4, 1.6, px, (h + 4) / 2, pz, bodyColor, accent);
    } else if (t.id === "hermes-community") {
      // Stepped terraces: 3 stacked shrinking boxes.
      const steps = [1, 0.78, 0.56];
      let y = 0;
      for (let i = 0; i < 3; i++) {
        const sh = h / 3;
        box(THREE, tg, w * steps[i], sh, d * steps[i], 0, y + sh / 2, 0, bodyColor, accent);
        y += sh;
      }
    } else if (t.id === "hermes-social") {
      // Slim tower plus 2 torus orbit rings.
      box(THREE, tg, w, h, d, 0, h / 2, 0, bodyColor, accent);
      for (let i = 0; i < 2; i++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(w * 0.95 + i * 2, 0.35, 8, 40),
          new THREE.MeshLambertMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.6 })
        );
        ring.rotation.x = Math.PI / 2 + (i === 0 ? 0.25 : -0.25);
        ring.position.set(0, h * (0.55 + i * 0.2), 0);
        tg.add(ring);
      }
    } else if (t.id === "super-hermes") {
      // Orb on a pedestal.
      const ped = new THREE.Mesh(
        new THREE.CylinderGeometry(w * 0.32, w * 0.42, h * 0.6, 12),
        new THREE.MeshLambertMaterial({ color: bodyColor })
      );
      ped.position.set(0, (h * 0.6) / 2, 0);
      edgeLines(THREE, ped, accent);
      tg.add(ped);
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(w * 0.42, 24, 16),
        new THREE.MeshLambertMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.8 })
      );
      orb.position.set(0, h * 0.6 + w * 0.42, 0);
      tg.add(orb);
    } else if (t.id === "chaos-mall") {
      // Low wide mall slab.
      box(THREE, tg, w, h, d, 0, h / 2, 0, bodyColor, accent);
      box(THREE, tg, w * 0.9, 1.2, d * 0.9, 0, h + 0.6, 0, bodyColor, accent);
    } else if (t.id === "builder-commons") {
      // Hex prism plus lattice crown: 6-segment cylinder plus wireframe top ring.
      const hex = new THREE.Mesh(
        new THREE.CylinderGeometry(w * 0.62, w * 0.62, h, 6),
        new THREE.MeshLambertMaterial({ color: bodyColor })
      );
      hex.position.set(0, h / 2, 0);
      edgeLines(THREE, hex, accent);
      tg.add(hex);
      const crown = new THREE.Mesh(
        new THREE.CylinderGeometry(w * 0.62, w * 0.5, 3, 6, 1, true),
        new THREE.MeshBasicMaterial({ color: accent, wireframe: true })
      );
      crown.position.set(0, h + 1.5, 0);
      tg.add(crown);
    } else {
      box(THREE, tg, w, h, d, 0, h / 2, 0, bodyColor, accent);
    }
    const label = makeLabel(THREE, t.sign, accentCss);
    label.position.set(0, h + 9, 0);
    tg.add(label);
    group.add(tg);
    towers.push({ id: t.id, sign: t.sign, tag: t.tag || "", x: t.x, z: t.z, h: t.h, w: t.w, d: t.d, accent: accent, shape: t.shape || "", group: tg });
  }

  // Four district ground planes and markers.
  const markers = [];
  const districtDefs = layoutData.districts || [
    { id: "ATG", label: "ATG", x: -78, z: -20 },
    { id: "DOCKING", label: "DOCKING", x: 78, z: -20 },
    { id: "HERMES-CITY", label: "HERMES CITY", x: 0, z: 0 },
    { id: "AQUADUCT", label: "AQUADUCT", x: 0, z: 68 },
  ];
  for (const dd of districtDefs) {
    const isCity = dd.id === "HERMES-CITY";
    const pw = isCity ? 130 : 30;
    const pd = isCity ? 120 : 22;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(pw, pd),
      new THREE.MeshLambertMaterial({ color: 0x0e1622, transparent: true, opacity: isCity ? 0.0 : 0.85 })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(dd.x, 0.08, dd.z);
    group.add(plane);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1, 1.15, 32),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide, transparent: true, opacity: 0.5 })
    );
    if (!isCity) {
      ring.rotation.x = -Math.PI / 2;
      ring.scale.set(14, 14, 1);
      ring.position.set(dd.x, 0.12, dd.z);
      group.add(ring);
    }
    const label = makeLabel(THREE, dd.label, "#00e5ff");
    label.scale.set(26, 4.9, 1);
    // The HERMES CITY label sits at the city center by default, where it
    // overlaps the HERMES HQ tower label. Move it to the open southwest
    // corner of the ground plane instead.
    if (isCity) label.position.set(-72, 6, 55);
    else label.position.set(dd.x, 8, dd.z);
    group.add(label);
    markers.push({ id: dd.id, label: dd.label, x: dd.x, z: dd.z });
  }

  // Lights (no shadows).
  const ambient = new THREE.AmbientLight(0xffffff, 0.75);
  group.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(60, 120, 40);
  group.add(dir);

  // Agents: one InstancedMesh of 100 small boxes.
  const agentCount = layoutData.agentCount || 100;
  const agentGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
  const agentMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const agents = new THREE.InstancedMesh(agentGeo, agentMat, agentCount);
  agents.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  agents.frustumCulled = false;
  group.add(agents);

  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();
  const basePositions = [];

  function computeCurrent(world, tick, index) {
    const districtIdx = world.agents.district[index];
    const districtName = (layoutData.districtNames && layoutData.districtNames[districtIdx]) || "HERMES-CITY";
    const base = basePositions[index] || (basePositions[index] = basePositionForAgent(index, districtName));
    const bob = bobOffset(tick, index);
    return { x: base.x + bob.x, y: base.y + bob.y, z: base.z + bob.z };
  }

  function updateAgents(world, tick) {
    // Snapshot prev = current, then compute new current for the new tick.
    world.forEachAlive(function (index) {
      world.agents.prevX[index] = world.agents.posX[index];
      world.agents.prevY[index] = world.agents.posY[index];
      world.agents.prevZ[index] = world.agents.posZ[index];
      const cur = computeCurrent(world, tick, index);
      world.agents.posX[index] = cur.x;
      world.agents.posY[index] = cur.y;
      world.agents.posZ[index] = cur.z;
    });
  }

  function drawAgents(world, alpha) {
    let n = 0;
    world.forEachAlive(function (index) {
      const x = world.agents.prevX[index] + (world.agents.posX[index] - world.agents.prevX[index]) * alpha;
      const y = world.agents.prevY[index] + (world.agents.posY[index] - world.agents.prevY[index]) * alpha;
      const z = world.agents.prevZ[index] + (world.agents.posZ[index] - world.agents.prevZ[index]) * alpha;
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      agents.setMatrixAt(index, dummy.matrix);
      tmpColor.setHex(agentColorForState(world.agents.state[index]));
      agents.setColorAt(index, tmpColor);
      n += 1;
    });
    agents.count = Math.max(n, 0);
    agents.instanceMatrix.needsUpdate = true;
    if (agents.instanceColor) agents.instanceColor.needsUpdate = true;
  }

  function agentRenderPositions(world, alpha) {
    const out = [];
    world.forEachAlive(function (index) {
      out.push([
        world.agents.prevX[index] + (world.agents.posX[index] - world.agents.prevX[index]) * alpha,
        world.agents.prevY[index] + (world.agents.posY[index] - world.agents.prevY[index]) * alpha,
        world.agents.prevZ[index] + (world.agents.posZ[index] - world.agents.prevZ[index]) * alpha,
      ]);
    });
    return out;
  }

  return {
    group: group,
    towers: towers,
    towerCount: towers.length,
    markers: markers,
    agents: agents,
    agentCount: agentCount,
    basePositions: basePositions,
    updateAgents: updateAgents,
    drawAgents: drawAgents,
    agentRenderPositions: agentRenderPositions,
    computeCurrent: computeCurrent,
  };
}
