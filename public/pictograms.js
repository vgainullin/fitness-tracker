// Exercise pictograms, generated from code rather than drawn by hand.
//
// Every icon is the same stick figure (fixed bone lengths, stroke weights and
// colours) posed by a movement pattern, plus an equipment glyph placed by the
// pattern. An exercise picks its pattern and equipment from its name and
// database fields, so new or custom exercises get an icon with no extra work.
// To fix a wrong icon, add the exercise name to OVERRIDES; to add a new
// movement, add a pattern and a rule.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Pictograms = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---- Figure geometry (viewBox 0 0 100 100, figure faces right) ----
  // Angles are SVG degrees: 0 = right/forward, 90 = down, -90 = up, 180 = back.
  const BONE = { torso: 28, neck: 4, head: 7, upper: 16, fore: 15, thigh: 20, shin: 20, foot: 6 };
  const SHOULDER_HALF = 9; // front view
  const HIP_HALF = 5;      // front view
  const GROUND = 94;
  const STROKE = { limb: 7, torso: 9, equip: 3.5 };
  const EQUIP_COLOR = '#8a8580';

  const rad = d => d * Math.PI / 180;
  const step = (p, ang, len) => [p[0] + Math.cos(rad(ang)) * len, p[1] + Math.sin(rad(ang)) * len];
  const mirror = a => 180 - a;
  const r1 = n => Math.round(n * 10) / 10;

  // Base poses. Patterns override only what differs.
  const STAND = { view: 'side', hip: [50, 51], torso: -90, arm: [90, 90], leg: [90, 90] };
  const FRONT = { view: 'front', hip: [50, 51], torso: -90, arm: [100, 92], leg: [92, 90] };

  function skeleton(pose) {
    const p = Object.assign({}, pose.view === 'front' ? FRONT : STAND, pose);
    const j = { view: p.view };
    j.hip = p.hip;
    j.shoulder = step(p.hip, p.torso, BONE.torso);
    j.neck = step(j.shoulder, p.neck == null ? p.torso : p.neck, BONE.neck);
    j.head = step(j.neck, p.neck == null ? p.torso : p.neck, BONE.head);
    const arm2 = p.arm2 || p.arm, leg2 = p.leg2 || p.leg;
    if (p.view === 'front') {
      j.shoulderR = [j.shoulder[0] + SHOULDER_HALF, j.shoulder[1]];
      j.shoulderL = [j.shoulder[0] - SHOULDER_HALF, j.shoulder[1]];
      j.hipR = [p.hip[0] + HIP_HALF, p.hip[1]];
      j.hipL = [p.hip[0] - HIP_HALF, p.hip[1]];
      j.elbow = step(j.shoulderR, p.arm[0], BONE.upper);
      j.wrist = step(j.elbow, p.arm[1], BONE.fore);
      j.elbow2 = step(j.shoulderL, mirror(arm2[0]), BONE.upper);
      j.wrist2 = step(j.elbow2, mirror(arm2[1]), BONE.fore);
      j.knee = step(j.hipR, p.leg[0], BONE.thigh);
      j.ankle = step(j.knee, p.leg[1], BONE.shin);
      j.knee2 = step(j.hipL, mirror(leg2[0]), BONE.thigh);
      j.ankle2 = step(j.knee2, mirror(leg2[1]), BONE.shin);
      j.toe = step(j.ankle, p.foot == null ? 20 : p.foot, BONE.foot * 0.6);
      j.toe2 = step(j.ankle2, mirror(p.foot == null ? 20 : p.foot), BONE.foot * 0.6);
    } else {
      j.elbow = step(j.shoulder, p.arm[0], BONE.upper);
      j.wrist = step(j.elbow, p.arm[1], BONE.fore);
      j.elbow2 = step(j.shoulder, arm2[0], BONE.upper);
      j.wrist2 = step(j.elbow2, arm2[1], BONE.fore);
      j.knee = step(p.hip, p.leg[0], BONE.thigh);
      j.ankle = step(j.knee, p.leg[1], BONE.shin);
      j.knee2 = step(p.hip, leg2[0], BONE.thigh);
      j.ankle2 = step(j.knee2, leg2[1], BONE.shin);
      j.toe = step(j.ankle, p.foot == null ? p.leg[1] - 90 : p.foot, BONE.foot);
      j.toe2 = step(j.ankle2, p.foot2 == null ? (p.foot == null ? leg2[1] - 90 : p.foot) : p.foot2, BONE.foot);
    }
    return j;
  }

  // ---- Movement patterns ----
  // pose: figure; props: fixed scenery (bench, bar, machine) in EQUIP_COLOR;
  // hold: where the load sits (joint name, or [joint, dx, dy]); anchor: cable/band
  // pulley; load: false when the pattern never shows a hand-held weight.
  const B = (a, b, legs) => ({ t: 'bench', a, b, legs: legs !== false });
  const L = (a, b, w) => ({ t: 'line', a, b, w });
  const C = (c, r, fill) => ({ t: 'circle', c, r, fill: fill !== false });
  const BAR = (y, x1, x2) => L([x1, y], [x2, y], 3.5);

  const PATTERNS = {
    stand: { pose: {} },
    // Legs: squat family
    squat: { pose: { hip: [44, 62], torso: -62, arm: [150, -50], leg: [18, 108] }, hold: ['shoulder', -7, 1] },
    front_squat: { pose: { hip: [44, 62], torso: -74, arm: [30, -110], leg: [18, 108] }, hold: ['shoulder', 10, 1] },
    goblet_squat: { pose: { hip: [44, 62], torso: -72, arm: [60, -120], leg: [18, 108] }, hold: ['wrist', 1, 4] },
    air_squat: { pose: { hip: [44, 62], torso: -66, arm: [-6, -6], leg: [18, 108] }, load: false },
    overhead_squat: { pose: { hip: [44, 62], torso: -72, arm: [-78, -78], leg: [18, 108] } },
    hack_squat: { pose: { hip: [46, 60], torso: -70, arm: [-70, -110], leg: [10, 110] }, props: [L([22, 70], [44, 8], 6), L([30, 92], [74, 92], 4)], load: false },
    leg_press: { pose: { hip: [36, 72], torso: -150, arm: [60, 0], leg: [-50, 0], foot: -100 }, props: [L([8, 62], [30, 78], 6), L([30, 78], [44, 78], 6), L([66, 44], [74, 72], 6), L([36, 78], [36, 92], 3), L([24, 92], [48, 92], 3)], load: false },
    sissy_squat: { pose: { hip: [56, 66], torso: -110, arm: [20, 0], leg: [30, 130] }, load: false },
    pistol: { pose: { hip: [42, 64], torso: -62, arm: [0, 0], leg: [20, 110], leg2: [0, 0] }, load: false },
    wall_sit: { pose: { hip: [34, 64], torso: -90, arm: [90, 90], leg: [0, 90] }, props: [L([28, 6], [28, 94], 4)], load: false },
    // Legs: single-leg
    lunge: { pose: { hip: [48, 56], torso: -88, arm: [92, 90], leg: [40, 90], leg2: [118, 168], foot2: 180 } },
    split_squat: { pose: { hip: [48, 56], torso: -86, arm: [92, 90], leg: [40, 90], leg2: [120, 170] }, props: [B([14, 70], [28, 70])] },
    step_up: { pose: { hip: [46, 50], torso: -84, arm: [92, 90], leg: [-10, 98], leg2: [100, 90] }, props: [{ t: 'rect', x: 50, y: 70, w: 30, h: 24 }] },
    // Legs: hinge
    deadlift: { pose: { hip: [40, 52], torso: -28, arm: [92, 90], leg: [30, 112] } },
    rdl: { pose: { hip: [42, 50], torso: -16, arm: [90, 90], leg: [86, 94] } },
    good_morning: { pose: { hip: [42, 50], torso: -12, arm: [130, -60], leg: [86, 94] }, hold: ['shoulder', -1, -8] },
    single_leg_rdl: { pose: { hip: [44, 52], torso: -6, arm: [90, 90], leg: [90, 90], leg2: [178, 178], foot2: 90 } },
    kb_swing: { pose: { hip: [40, 54], torso: -45, arm: [10, 10], leg: [70, 104] }, hold: ['wrist', 0, 2] },
    pull_through: { pose: { hip: [44, 52], torso: -24, arm: [100, 120], leg: [76, 100] }, anchor: [8, 86] },
    hip_thrust: { pose: { hip: [50, 56], torso: 178, arm: [80, 30], leg: [-4, 92], neck: -170 }, props: [B([12, 66], [30, 66])], hold: ['hip', 0, -6] },
    glute_bridge: { pose: { hip: [44, 74], torso: 162, arm: [20, 10], leg: [-24, 100], neck: 175 }, hold: ['hip', 0, -6] },
    back_extension: { pose: { hip: [46, 54], torso: -4, arm: [90, 90], leg: [158, 158], foot: 90 }, props: [L([30, 62], [56, 62], 6), L([12, 80], [22, 72], 6), L([42, 64], [42, 94], 3)], load: false },
    reverse_hyper: { pose: { hip: [44, 52], torso: 0, arm: [90, 90], leg: [170, 170], foot: 90 }, props: [B([40, 60], [78, 60])], load: false },
    // Legs: machines
    leg_extension: { pose: { hip: [46, 60], torso: -96, arm: [86, 30], leg: [0, 10] }, props: [L([40, 66], [60, 66], 6), L([36, 66], [30, 22], 6), C([88, 66], 4), L([50, 66], [50, 94], 3)], load: false },
    leg_curl_lying: { pose: { hip: [54, 58], torso: 180, arm: [90, 60], leg: [0, -80], neck: 175 }, props: [B([14, 64], [80, 64]), C([76, 36], 4)], load: false },
    leg_curl_seated: { pose: { hip: [44, 60], torso: -96, arm: [86, 30], leg: [0, 110] }, props: [L([38, 66], [58, 66], 6), L([34, 66], [28, 22], 6), C([62, 82], 4), L([48, 66], [48, 94], 3)], load: false },
    leg_curl_standing: { pose: { leg2: [90, 90], leg: [80, 190], arm: [20, 60] }, props: [L([72, 30], [72, 94], 4)], load: false },
    nordic: { pose: { hip: [52, 64], torso: -40, arm: [60, 40], leg: [90, 180], foot: 180 }, load: false },
    calf_raise: { pose: { hip: [50, 48], arm: [90, 90], leg: [90, 90], foot: 50 }, props: [{ t: 'rect', x: 46, y: 90, w: 22, h: 6 }] },
    seated_calf: { pose: { hip: [40, 62], torso: -90, arm: [40, 20], leg: [0, 90], foot: -20 }, props: [L([30, 68], [48, 68], 6), L([46, 56], [66, 56], 5), L([38, 68], [38, 94], 3)], load: false },
    hip_abduction: { pose: { view: 'front', hip: [50, 62], arm: [80, 90], leg: [50, 80] }, props: [L([28, 70], [72, 70], 6)], load: false },
    hip_adduction: { pose: { view: 'front', hip: [50, 62], arm: [80, 90], leg: [70, 92] }, props: [L([28, 70], [72, 70], 6)], load: false },
    band_walk: { pose: { view: 'front', leg: [75, 90], arm: [80, 70] }, band: 'knees', load: false },
    kickback_glute: { pose: { hip: [52, 50], torso: -20, arm: [80, 90], leg: [86, 92], leg2: [170, 150] }, anchor: [6, 80] },
    // Chest
    bench_press: { pose: { hip: [62, 62], torso: 180, arm: [-86, -94], leg: [32, 96], neck: 180 }, props: [B([18, 69], [70, 69])] },
    incline_press: { pose: { hip: [54, 64], torso: -145, arm: [-88, -92], leg: [20, 90], neck: -145 }, props: [L([22, 34], [52, 70], 6), L([42, 72], [62, 72], 6), L([46, 72], [46, 94], 3)] },
    decline_press: { pose: { hip: [64, 54], torso: 165, arm: [-84, -96], leg: [20, 70], neck: 165 }, props: [L([20, 70], [70, 58], 6), L([44, 64], [44, 94], 3)] },
    fly: { pose: { hip: [62, 62], torso: 180, arm: [-60, -100], arm2: [-120, -80], leg: [32, 96], neck: 180 }, props: [B([18, 69], [70, 69])] },
    pullover: { pose: { hip: [64, 62], torso: 180, arm: [-160, -160], leg: [32, 96], neck: 180 }, props: [B([18, 69], [70, 69])] },
    floor_press: { pose: { hip: [64, 84], torso: 180, arm: [-86, -94], leg: [-40, 80], neck: 180 }, props: [L([6, 94], [94, 94], 2)] },
    pushup: { pose: { hip: [54, 66], torso: 190, arm: [90, 90], leg: [10, 10], neck: 195 }, props: [L([6, 94], [94, 94], 2)], load: false },
    incline_pushup: { pose: { hip: [54, 60], torso: 200, arm: [105, 105], leg: [22, 22], neck: 205 }, props: [{ t: 'rect', x: 14, y: 76, w: 18, h: 18 }], load: false },
    dip: { pose: { hip: [50, 56], torso: -80, arm: [150, 70], leg: [100, 150] }, props: [L([30, 66], [56, 66], 4), L([36, 66], [36, 94], 3)], load: false },
    bench_dip: { pose: { hip: [44, 64], torso: -96, arm: [120, 60], leg: [-6, 6] }, props: [B([20, 60], [40, 60])], load: false },
    cable_fly: { pose: { arm: [10, 30], arm2: [-10, 20], leg: [80, 96], leg2: [110, 92], torso: -80 }, anchor: [92, 20] },
    chest_press_machine: { pose: { hip: [40, 60], torso: -96, arm: [0, 0], leg: [0, 90] }, props: [L([32, 66], [50, 66], 6), L([30, 66], [26, 24], 6), L([72, 20], [72, 60], 5), L([40, 66], [40, 94], 3)], load: false },
    pec_deck: { pose: { view: 'front', hip: [50, 62], arm: [-40, -110], leg: [75, 92] }, props: [L([28, 70], [72, 70], 6)], load: false },
    // Shoulders
    ohp: { pose: { view: 'front', arm: [-60, -88] } },
    seated_ohp: { pose: { hip: [46, 62], torso: -90, arm: [-80, -95], leg: [0, 90] }, props: [L([38, 68], [56, 68], 6), L([38, 68], [38, 30], 6), L([46, 68], [46, 94], 3)] },
    machine_press: { pose: { hip: [46, 62], torso: -90, arm: [-80, -95], leg: [0, 90] }, props: [L([38, 68], [56, 68], 6), L([38, 68], [38, 30], 6), L([46, 68], [46, 94], 3), L([58, 12], [58, 40], 3)], load: false },
    lateral_raise: { pose: { view: 'front', arm: [0, 4] } },
    front_raise: { pose: { arm: [0, 0], arm2: [90, 90] } },
    rear_delt: { pose: { hip: [42, 52], torso: -20, view: 'side', arm: [-40, -40], arm2: [140, 140], leg: [80, 96] } },
    face_pull: { pose: { arm: [-10, 170], leg: [80, 96], leg2: [102, 90] }, anchor: [94, 18] },
    upright_row: { pose: { view: 'front', arm: [-20, 120] }, hold: ['wrist', -4, 0] },
    shrug: { pose: { view: 'front', arm: [92, 90] } },
    external_rotation: { pose: { arm: [90, -10] }, anchor: [94, 50] },
    band_pull_apart: { pose: { view: 'front', arm: [0, 0] }, band: 'hands', load: false },
    handstand_pushup: { pose: { view: 'front', hip: [50, 30], torso: 90, arm: [60, 110], leg: [-88, -90] }, props: [L([20, 84], [80, 84], 2)], load: false },
    landmine_press: { pose: { arm: [-40, -40], torso: -80, leg: [80, 96], leg2: [110, 92] }, props: [L([6, 92], [60, 26], 3.5)], load: false },
    // Back
    pullup: { pose: { view: 'front', hip: [50, 62], arm: [-50, -100], leg: [92, 92] }, props: [BAR(6, 14, 86)], load: false },
    chinup: { pose: { view: 'front', hip: [50, 60], arm: [-70, -90], leg: [92, 92] }, props: [BAR(6, 14, 86)], load: false },
    muscle_up: { pose: { view: 'front', hip: [50, 46], arm: [100, -100], leg: [92, 92] }, props: [BAR(36, 14, 86)], load: false },
    pulldown: { pose: { view: 'front', hip: [50, 64], arm: [-50, -100], leg: [-10, 90] }, props: [L([34, 72], [66, 72], 6), L([24, 14], [76, 14], 3.5), L([50, 4], [50, 14], 2)], load: false },
    straight_arm_pulldown: { pose: { torso: -76, hip: [46, 51], arm: [30, 30], leg: [84, 96] }, anchor: [94, 6] },
    row_bent: { pose: { hip: [40, 52], torso: -24, arm: [110, 0], leg: [70, 104] }, hold: ['wrist', 2, 2] },
    row_one_arm: { pose: { hip: [36, 54], torso: -14, arm: [110, 0], arm2: [90, 90], leg: [90, 90], leg2: [60, 180], foot2: 180 }, props: [B([40, 74], [74, 74])] },
    row_seated: { pose: { hip: [38, 70], torso: -96, arm: [20, 170], leg: [-6, 6] }, props: [L([30, 76], [64, 76], 5), L([74, 66], [80, 92], 4)], anchor: [92, 72] },
    row_chest_supported: { pose: { hip: [36, 62], torso: -40, arm: [100, 20], leg: [70, 110] }, props: [L([30, 70], [64, 36], 6), L([46, 64], [46, 94], 3)] },
    row_machine: { pose: { hip: [36, 64], torso: -90, arm: [180, 10], leg: [10, 90] }, props: [L([28, 70], [46, 70], 6), L([54, 30], [54, 60], 6), L([38, 70], [38, 94], 3), L([62, 40], [80, 40], 4)], load: false },
    tbar_row: { pose: { hip: [40, 52], torso: -26, arm: [110, 0], leg: [70, 104] }, props: [L([8, 94], [52, 60], 3.5)], hold: ['wrist', 2, 2] },
    inverted_row: { pose: { hip: [52, 66], torso: 200, arm: [-70, -100], leg: [12, 12], neck: 200 }, props: [BAR(34, 6, 40), L([8, 34], [8, 94], 3)], load: false },
    deadhang: { pose: { view: 'front', hip: [50, 66], arm: [-80, -80], leg: [92, 92] }, props: [BAR(6, 14, 86)], load: false },
    scap_pullup: { pose: { view: 'front', hip: [50, 64], arm: [-80, -82], leg: [92, 92] }, props: [BAR(6, 14, 86)], load: false },
    renegade_row: { pose: { hip: [54, 66], torso: 190, arm: [90, 90], arm2: [140, -40], leg: [10, 10], neck: 195 }, hold: 'wrist2' },
    // Arms
    curl: { pose: { arm: [92, -50] } },
    curl_cable: { pose: { arm: [92, -50] }, anchor: [72, 92] },
    curl_overhead_cable: { pose: { view: 'front', arm: [0, -80] }, anchor: [94, 10] },
    preacher_curl: { pose: { hip: [40, 62], torso: -84, arm: [40, -40], leg: [0, 90] }, props: [L([46, 40], [64, 56], 6), L([60, 56], [60, 94], 3), L([32, 68], [48, 68], 5)] },
    incline_curl: { pose: { hip: [54, 64], torso: -130, arm: [98, 80], leg: [20, 90], neck: -120 }, props: [L([28, 34], [52, 70], 6), L([42, 72], [62, 72], 6), L([46, 72], [46, 94], 3)] },
    concentration_curl: { pose: { hip: [36, 62], torso: -50, arm: [80, -30], leg: [0, 100] }, props: [B([22, 68], [44, 68])] },
    pushdown: { pose: { arm: [96, 80], leg: [86, 94] }, anchor: [72, 6] },
    triceps_overhead: { pose: { arm: [-76, 150], leg: [86, 94] }, hold: ['wrist', -2, 0] },
    triceps_overhead_cable: { pose: { torso: -70, arm: [-50, -20], leg: [80, 98], leg2: [110, 90] }, anchor: [10, 54] },
    skullcrusher: { pose: { hip: [62, 62], torso: 180, arm: [-100, 150], leg: [32, 96], neck: 180 }, props: [B([18, 69], [70, 69])] },
    kickback: { pose: { hip: [40, 52], torso: -20, arm: [170, 170], arm2: [90, 90], leg: [80, 100] } },
    wrist_curl: { pose: { hip: [36, 62], torso: -66, arm: [50, 0], leg: [0, 100] }, props: [B([22, 68], [44, 68])] },
    // Core
    crunch: { pose: { hip: [60, 86], torso: 200, arm: [-30, -150], leg: [-50, 60], neck: 215 }, props: [L([6, 94], [94, 94], 2)], load: false },
    situp: { pose: { hip: [54, 86], torso: -135, arm: [-60, 150], leg: [-30, 60], neck: -130 }, props: [L([6, 94], [94, 94], 2)], load: false },
    reverse_crunch: { pose: { hip: [54, 84], torso: 180, arm: [10, 10], leg: [-110, -10], neck: 180 }, props: [L([6, 94], [94, 94], 2)], load: false },
    leg_raise: { pose: { hip: [54, 86], torso: 180, arm: [10, 10], leg: [-60, -60], neck: 180 }, props: [L([6, 94], [94, 94], 2)], load: false },
    hanging_leg_raise: { pose: { hip: [46, 62], torso: -90, arm: [-74, -74], leg: [0, 0] }, props: [BAR(-2, 36, 76)], load: false },
    captains_chair: { pose: { hip: [50, 56], torso: -90, arm: [0, -90], leg: [-10, 90] }, props: [L([34, 22], [34, 94], 5), L([34, 38], [66, 38], 5)], load: false },
    plank: { pose: { hip: [54, 76], torso: 188, arm: [90, 0], leg: [9, 9], neck: 190 }, props: [L([6, 94], [94, 94], 2)], load: false },
    side_plank: { pose: { view: 'side', hip: [50, 74], torso: 196, arm: [90, 0], arm2: [-90, -90], leg: [14, 14], neck: 196 }, props: [L([6, 94], [94, 94], 2)], load: false },
    mountain_climber: { pose: { hip: [56, 64], torso: 190, arm: [90, 90], leg: [10, 10], leg2: [140, 60], neck: 195 }, props: [L([6, 94], [94, 94], 2)], load: false },
    russian_twist: { pose: { hip: [44, 84], torso: -120, arm: [20, -30], leg: [-30, 50], neck: -110 }, props: [L([6, 94], [94, 94], 2)] },
    dead_bug: { pose: { hip: [56, 84], torso: 180, arm: [-90, -90], arm2: [-150, -150], leg: [-90, 0], leg2: [-20, -10], neck: 180 }, props: [L([6, 94], [94, 94], 2)], load: false },
    ab_wheel: { pose: { hip: [44, 66], torso: 20, arm: [80, 80], leg: [90, 180], foot: 180 }, props: [C([78, 84], 7, false), L([6, 94], [94, 94], 2)], load: false },
    cable_crunch: { pose: { hip: [44, 64], torso: -10, arm: [-60, 150], leg: [90, 180], neck: 40, foot: 180 }, anchor: [80, 8], load: false },
    side_bend: { pose: { view: 'front', torso: -76, arm: [96, 90] } },
    woodchop: { pose: { torso: -90, arm: [-40, -40], leg: [80, 96], leg2: [104, 90] }, anchor: [94, 8] },
    pallof: { pose: { view: 'front', arm: [60, 120] }, anchor: [94, 40] },
    // Full body, olympic, strongman
    clean: { pose: { hip: [46, 54], torso: -80, arm: [40, -120], leg: [40, 110] }, hold: ['shoulder', 10, 1] },
    snatch: { pose: { hip: [44, 62], torso: -72, arm: [-78, -78], leg: [18, 108] } },
    jerk: { pose: { hip: [48, 54], torso: -88, arm: [-74, -74], leg: [40, 90], leg2: [130, 160], foot2: 180 } },
    push_press: { pose: { view: 'front', arm: [-60, -88], leg: [84, 100] } },
    thruster: { pose: { hip: [46, 58], torso: -78, arm: [-60, -90], leg: [40, 110] } },
    turkish_getup: { pose: { hip: [50, 74], torso: -150, arm: [-90, -90], arm2: [130, 90], leg: [-40, 80], leg2: [10, 10], neck: -150 }, props: [L([6, 94], [94, 94], 2)] },
    carry: { pose: { arm: [92, 90], leg: [66, 100], leg2: [116, 82] }, hold: 'both' },
    sled_push: { pose: { hip: [36, 60], torso: -20, arm: [0, 0], leg: [60, 120], leg2: [130, 100] }, props: [L([72, 50], [72, 92], 4), L([66, 92], [94, 92], 4), L([72, 50], [64, 50], 4)], load: false },
    tire_flip: { pose: { hip: [36, 58], torso: -24, arm: [30, 0], leg: [50, 110] }, props: [{ t: 'rect', x: 60, y: 62, w: 32, h: 30, rx: 10 }], load: false },
    battle_ropes: { pose: { hip: [44, 60], torso: -74, arm: [40, 0], leg: [30, 110] }, props: [{ t: 'wave', a: [74, 70], b: [96, 90] }], load: false },
    box_jump: { pose: { hip: [48, 40], torso: -76, arm: [-60, -60], leg: [30, 130] }, props: [{ t: 'rect', x: 56, y: 64, w: 30, h: 30 }], load: false },
    jump: { pose: { torso: -84, arm: [-40, -50], leg: [60, 120], leg2: [70, 130] }, props: [L([30, 100], [70, 100], 2)], load: false },
    jumping_jack: { pose: { view: 'front', arm: [-40, -60], leg: [70, 70] }, load: false },
    burpee: { pose: { view: 'front', arm: [-70, -80], leg: [80, 84] }, props: [L([30, 98], [70, 98], 2)], load: false },
    slam: { pose: { view: 'front', arm: [-75, -125], leg: [80, 96] }, hold: 'mid' },
    // Cardio
    run: { pose: { torso: -80, arm: [130, 40], arm2: [50, -40], leg: [40, 110], leg2: [120, 170] }, load: false },
    walk_treadmill: { pose: { torso: -88, arm: [100, 80], arm2: [80, 60], leg: [72, 96], leg2: [110, 90] }, props: [L([14, 94], [84, 94], 4), L([84, 94], [80, 40], 3), L([72, 40], [84, 40], 3)], load: false },
    bike: { pose: { hip: [36, 50], torso: -40, arm: [40, 50], leg: [20, 110], leg2: [80, 80] }, props: [C([24, 82], 12, false), C([78, 82], 12, false), L([36, 56], [58, 80], 4), L([72, 34], [78, 82], 3)], load: false },
    rower: { pose: { hip: [44, 74], torso: -110, arm: [180, 20], leg: [-30, 50] }, props: [L([8, 82], [92, 82], 4), C([88, 68], 8, false)], load: false },
    elliptical: { pose: { torso: -86, hip: [46, 46], arm: [50, -40], leg: [70, 100], leg2: [110, 80] }, props: [L([24, 90], [80, 90], 4), L([80, 90], [76, 26], 3)], load: false },
    stairs: { pose: { hip: [46, 44], torso: -80, arm: [70, 20], leg: [10, 100], leg2: [100, 80] }, props: [{ t: 'stairs' }], load: false },
    jump_rope: { pose: { hip: [50, 46], torso: -90, arm: [100, 30], leg: [96, 92] }, props: [{ t: 'arc' }], load: false },
    stretch: { pose: { arm: [-80, -80], arm2: [100, 120], leg: [90, 90], leg2: [140, 70] }, load: false },
  };

  // ---- Classification ----
  // Ordered: the first matching rule wins, so specific names go before generic ones.
  const RULES = [
    [/stretch|smr|foam roll|yoga|pose\b|circles|drill|mobility|limber|world'?s greatest/, 'stretch'],
    [/jumping jack|star jump/, 'jumping_jack'],
    [/burpee|squat thrust/, 'burpee'],
    [/box jump|box skip|bench jump/, 'box_jump'],
    [/rope jump|jump rope|skipping/, 'jump_rope'],
    [/tuck jump|jump squat|squat jump|long jump|split jump|scissors jump|\bhops?\b|\bbound|depth jump|\bleap/, 'jump'],
    [/treadmill|walking, |trail running|jogging/, 'walk_treadmill'],
    [/running|sprint|run\b|prowler/, 'run'],
    [/bicycl|bike|cycling/, 'bike'],
    [/rowing, stationary|ergometer|rowing machine/, 'rower'],
    [/elliptical/, 'elliptical'],
    [/stairmaster|step mill|stair/, 'stairs'],
    [/battl(e|ing) rope/, 'battle_ropes'],
    [/sled (push|drag)|sled push|prowler/, 'sled_push'],
    [/tire flip/, 'tire_flip'],
    [/farmer|carry|yoke|suitcase/, 'carry'],
    [/turkish get/, 'turkish_getup'],
    [/slam|overhead throw/, 'slam'],
    [/thruster/, 'thruster'],
    [/snatch(?! pull| shrug| deadlift)/, 'snatch'],
    [/overhead squat/, 'overhead_squat'],
    [/jerk/, 'jerk'],
    [/clean(?! deadlift| pull| shrug)/, 'clean'],
    [/push press/, 'push_press'],
    [/muscle.?up/, 'muscle_up'],
    [/scapular pull|scap pull/, 'scap_pullup'],
    [/dead ?hang|bar hang/, 'deadhang'],
    [/chin.?up|chins\b/, 'chinup'],
    [/pull.?ups?\b|pullups/, 'pullup'],
    [/straight.?arm pull ?down|straight.?arm lat/, 'straight_arm_pulldown'],
    [/pull ?down/, 'pulldown'],
    [/inverted row|bodyweight mid row|suspended row|ring row/, 'inverted_row'],
    [/renegade row/, 'renegade_row'],
    [/t-bar row|long bar row|landmine row|meadows/, 'tbar_row'],
    [/chest.?supported|incline (bench )?row|dumbbell incline row|seal row|lying t-bar|lying cambered|prone row/, 'row_chest_supported'],
    [/upright .*row|high pull/, 'upright_row'],
    [/seated cable row|cable row|pulley row|low row|elevated cable row|cable pulley rows/, 'row_seated'],
    [/iso row|high row|machine row|seated row/, 'row_machine'],
    [/one.?arm (dumbbell|kettlebell) row|single.?arm (dumbbell )?row|kroc/, 'row_one_arm'],
    [/face pull|rope rear.?delt row/, 'face_pull'],
    [/rear delt row|row/, 'row_bent'],
    [/shrug/, 'shrug'],
    [/band pull.?apart|pull apart/, 'band_pull_apart'],
    [/external rotation|internal rotation|cuban press/, 'external_rotation'],
    [/reverse (machine )?fly|rear delt|reverse flye|back flyes|bent over .*lateral|rear lateral|cable rear|sled reverse flye/, 'rear_delt'],
    [/lateral raise|side lateral|laterals|deltoid raise|lateral$|y raise|scaption|iron cross/, 'lateral_raise'],
    [/front .*raise|front raise|plate raise|straight raises|raise over ?head|front delt raise/, 'front_raise'],
    [/handstand/, 'handstand_pushup'],
    [/landmine|linear jammer/, 'landmine_press'],
    [/machine shoulder|leverage shoulder|smith machine overhead|machine.*press.*shoulder/, 'machine_press'],
    [/seated (barbell |dumbbell |cable |kettlebell )?(military |shoulder )?press|arnold|seated .*shoulder press/, 'seated_ohp'],
    [/shoulder press|military press|overhead press|standing .*press|bradford|kettlebell .*press|see.?saw press|alternating .*press|press behind/, 'ohp'],
    // Chest
    [/pec deck|machine (chest )?fl(y|ies)|butterfly/, 'pec_deck'],
    [/crossover|cable fl(y|ye)|cable iron cross|cross over/, 'cable_fly'],
    [/pullover/, 'pullover'],
    [/incline .*fl(y|ye)/, 'fly'],
    [/fl(y|ye)s?\b/, 'fly'],
    [/floor press/, 'floor_press'],
    [/incline push|push.?up off|wall push/, 'incline_pushup'],
    [/push.?ups?|pushups|clock push|plyo push/, 'pushup'],
    [/bench dip/, 'bench_dip'],
    [/dips?\b|body.?up/, 'dip'],
    [/leverage .*chest press|^machine bench press|chest press/, 'chest_press_machine'],
    [/skull ?crusher|lying triceps|triceps press to chin|lying .*triceps? extension|tate press|jm press|triceps extension behind/, 'skullcrusher'],
    [/incline .*(bench )?press|incline .*db bench|incline dumbbell bench/, 'incline_press'],
    [/decline .*press/, 'decline_press'],
    [/bench press|dumbbell press|board press|pin press|guillotine|svend|close.?grip .*press|neck press|chain press/, 'bench_press'],
    // Leg curls and glute kickbacks first, so the arm rules below don't claim them
    [/seated leg curl|seated band hamstring/, 'leg_curl_seated'],
    [/standing leg curl/, 'leg_curl_standing'],
    [/leg curl/, 'leg_curl_lying'],
    [/glute kickback|cable kickback|donkey kick|hip extension with band/, 'kickback_glute'],
    // Arms
    [/pushdown|push.?down|kneeling cable triceps|low cable triceps/, 'pushdown'],
    [/kickback/, 'kickback'],
    [/overhead (triceps )?extension with rope|cable rope overhead|overhead arm extension - cable|cable .*overhead/, 'triceps_overhead_cable'],
    [/triceps? extension|tricep extension|triceps press|triceps overhead/, 'triceps_overhead'],
    [/wrist curl|wrist roller|finger curl|pronation|supination|wrist rotation/, 'wrist_curl'],
    [/preacher/, 'preacher_curl'],
    [/incline .*curl|curls lying against an incline|prone incline curl/, 'incline_curl'],
    [/concentration/, 'concentration_curl'],
    [/overhead cable curl|high cable curl/, 'curl_overhead_cable'],
    [/cable .*curl|curl.*cable|biceps cable/, 'curl_cable'],
    [/curl/, 'curl'],
    // Legs
    [/hip thrust|smith machine hip raise/, 'hip_thrust'],
    [/glute bridge|hip bridge|butt lift|hip lift|bridge\)/, 'glute_bridge'],
    [/pull ?through/, 'pull_through'],
    [/glute.?ham|nordic|hamstring slides/, 'nordic'],
    [/reverse hyper/, 'reverse_hyper'],
    [/hyperextension|back extension|superman/, 'back_extension'],
    [/good morning/, 'good_morning'],
    [/swing/, 'kb_swing'],
    [/one.?legged deadlift|single.?leg (romanian )?deadlift|single.?leg rdl/, 'single_leg_rdl'],
    [/romanian|stiff.?leg|rdl|stiff legs/, 'rdl'],
    [/deadlift|rack pull|axle|atlas|keg/, 'deadlift'],
    [/leg extension/, 'leg_extension'],
    [/seated .*calf|calf press|leg press machine/, 'seated_calf'],
    [/calf|heel raise/, 'calf_raise'],
    [/abductor|abduction|hip adduction|adductor|adduction/, null], // resolved below
    [/monster walk|band walk|lateral walk/, 'band_walk'],
    [/leg press/, 'leg_press'],
    [/hack squat/, 'hack_squat'],
    [/sissy/, 'sissy_squat'],
    [/bulgarian|split squat|rear foot/, 'split_squat'],
    [/pistol|single.?leg .*squat|one leg barbell squat/, 'pistol'],
    [/wall (sit|squat)/, 'wall_sit'],
    [/step.?ups?|step up/, 'step_up'],
    [/lunge|split/, 'lunge'],
    [/front (barbell )?squat|front squats|zercher/, 'front_squat'],
    [/goblet|dumbbell squat|plie|kettlebell .*squat|sumo squat/, 'goblet_squat'],
    [/bodyweight squat|air squat|prisoner squat|chair squat/, 'air_squat'],
    [/squat/, 'squat'],
    // Core
    [/ab roll|rollout|ab wheel|fallout/, 'ab_wheel'],
    [/cable crunch|rope crunch|cable seated crunch|kneeling cable crunch/, 'cable_crunch'],
    [/hanging (leg|knee)|hanging pike|toes.?to.?bar/, 'hanging_leg_raise'],
    [/knee\/hip raise|captain|parallel bars/, 'captains_chair'],
    [/reverse crunch|leg pull.?in|leg tucks|bottoms up|butt.?ups|hip raise|knee tuck/, 'reverse_crunch'],
    [/leg raise|flutter|scissor|leg lift/, 'leg_raise'],
    [/russian twist|seated .*twist|plate twist|heel touch/, 'russian_twist'],
    [/dead bug/, 'dead_bug'],
    [/mountain climber|spider crawl/, 'mountain_climber'],
    [/side (bridge|plank)/, 'side_plank'],
    [/plank/, 'plank'],
    [/side bend|trunk flexion/, 'side_bend'],
    [/wood ?chop|cable lift|judo flip|cable russian/, 'woodchop'],
    [/pallof/, 'pallof'],
    [/sit.?up|jackknife|v.?up/, 'situp'],
    [/crunch|air bike|elbow to knee|cocoons/, 'crunch'],
  ];

  // Exercise-specific fixes where the name alone misleads the rules.
  const OVERRIDES = {
    'calf press on the leg press machine': { pattern: 'leg_press', equipment: 'machine' },
    'calf press': { pattern: 'leg_press', equipment: 'machine' },
    'dumbbell floor press': { pattern: 'floor_press', equipment: 'dumbbell' },
    'cable deadlifts': { pattern: 'deadlift', equipment: 'cable' },
    'trap bar deadlift': { pattern: 'deadlift', equipment: 'barbell' },
    'bent over barbell row': { pattern: 'row_bent', equipment: 'barbell' },
    'alternating renegade row': { pattern: 'renegade_row', equipment: 'dumbbell' },
    'leverage deadlift': { pattern: 'deadlift', equipment: 'machine' },
    'mountain climbers': { pattern: 'mountain_climber' },
    'standing military press': { pattern: 'ohp', equipment: 'barbell' },
    'dumbbell shoulder press': { pattern: 'seated_ohp', equipment: 'dumbbell' },
    'triceps overhead extension with rope': { pattern: 'triceps_overhead_cable', equipment: 'cable' },
    'pull through': { pattern: 'pull_through', equipment: 'cable' },
    'cable hip adduction': { pattern: 'hip_adduction', equipment: 'machine' },
    'air bike': { pattern: 'crunch' },
    'cable one arm tricep extension': { pattern: 'pushdown', equipment: 'cable' },
    "farmer's walk": { pattern: 'carry', equipment: 'dumbbell' },
    'plate pinch': { pattern: 'carry' },
  };

  function inferEquipment(name, listed) {
    const n = name.toLowerCase();
    if (/smith/.test(n)) return 'smith';
    if (/kettlebell/.test(n)) return 'kettlebell';
    if (/dumbbell|\bdb\b/.test(n)) return 'dumbbell';
    if (/cable|pulley|rope attachment|pushdown|crossover/.test(n)) return 'cable';
    if (/\bez|ez-bar|ez bar/.test(n)) return 'ez curl bar';
    if (/band/.test(n)) return 'bands';
    if (/medicine ball|med ball/.test(n)) return 'medicine ball';
    if (/barbell|bar\b|bench press|deadlift|good morning|rack pull|military|hip thrust|squat(?!.*(body|air|goblet))/.test(n) && !/body.?weight|pull.?up|chin/.test(n)) {
      if (!(listed || []).length || (listed || []).includes('barbell')) return 'barbell';
    }
    if (/machine|leverage|lever\b/.test(n)) return 'machine';
    const order = ['barbell', 'dumbbell', 'kettlebell', 'cable', 'ez curl bar', 'medicine ball', 'bands', 'machine'];
    return order.find(e => (listed || []).includes(e)) || 'none';
  }

  function classify(exercise) {
    const ex = typeof exercise === 'string' ? { name: exercise } : (exercise || {});
    const name = String(ex.name || '');
    const n = name.toLowerCase();
    const o = OVERRIDES[n] || {};
    let pattern = o.pattern;
    if (!pattern) {
      for (const [re, p] of RULES) {
        if (!re.test(n)) continue;
        pattern = p || (/abduct/.test(n) ? 'hip_abduction' : 'hip_adduction');
        break;
      }
    }
    if (!pattern) pattern = fallbackPattern(ex);
    const equipment = o.equipment || inferEquipment(name, ex.equipment);
    return { pattern, equipment };
  }

  // Unknown names (custom exercises) fall back to a pose for their muscle group.
  function fallbackPattern(ex) {
    const m = String((ex.primary_muscles || [])[0] || ex.muscleGroup || '').toLowerCase();
    if (ex.category === 'stretching') return 'stretch';
    if (ex.category === 'cardio') return 'run';
    const byMuscle = {
      chest: 'bench_press', shoulders: 'ohp', biceps: 'curl', triceps: 'pushdown', forearms: 'wrist_curl',
      lats: 'pulldown', 'middle back': 'row_bent', back: 'row_bent', traps: 'shrug', 'lower back': 'back_extension',
      quads: 'squat', hamstrings: 'rdl', glutes: 'hip_thrust', calves: 'calf_raise', legs: 'squat',
      abs: 'crunch', core: 'crunch', obliques: 'russian_twist', arms: 'curl', abductors: 'hip_abduction', adductors: 'hip_adduction',
    };
    return byMuscle[m] || 'stand';
  }

  // ---- Rendering ----
  const seg = (a, b, color, w, extra) =>
    '<line x1="' + r1(a[0]) + '" y1="' + r1(a[1]) + '" x2="' + r1(b[0]) + '" y2="' + r1(b[1]) + '" stroke="' + color + '" stroke-width="' + w + '"' + (extra || '') + '/>';
  const circle = (c, r, color, fill, w) =>
    '<circle cx="' + r1(c[0]) + '" cy="' + r1(c[1]) + '" r="' + r + '"' + (fill ? ' fill="' + color + '"' : ' fill="none" stroke="' + color + '" stroke-width="' + (w || STROKE.equip) + '"') + '/>';

  function prop(p, color) {
    switch (p.t) {
      case 'line': return seg(p.a, p.b, color, p.w || 5);
      case 'bench': {
        let s = seg(p.a, p.b, color, 6);
        if (p.legs) {
          const ground = GROUND;
          const midA = [p.a[0] + (p.b[0] - p.a[0]) * 0.2, p.a[1] + (p.b[1] - p.a[1]) * 0.2];
          const midB = [p.a[0] + (p.b[0] - p.a[0]) * 0.8, p.a[1] + (p.b[1] - p.a[1]) * 0.8];
          s += seg(midA, [midA[0], ground], color, 3) + seg(midB, [midB[0], ground], color, 3);
        }
        return s;
      }
      case 'circle': return circle(p.c, p.r, color, p.fill);
      case 'rect': return '<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" rx="' + (p.rx || 2) + '" fill="' + color + '"/>';
      case 'wave': {
        const [a, b] = [p.a, p.b];
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        return '<path d="M' + a[0] + ' ' + a[1] + ' Q' + (mx - 6) + ' ' + (my + 12) + ' ' + mx + ' ' + my + ' T' + b[0] + ' ' + b[1] + '" fill="none" stroke="' + color + '" stroke-width="3"/>';
      }
      case 'stairs': return '<path d="M58 94 V82 H70 V70 H82 V58 H94" fill="none" stroke="' + color + '" stroke-width="4" stroke-linejoin="round"/>';
      case 'arc': return '<path d="M38 60 Q50 108 66 60" fill="none" stroke="' + color + '" stroke-width="2.5"/>';
      default: return '';
    }
  }

  function holdPoint(j, hold) {
    if (!hold) return [j.wrist];
    if (hold === 'both') return [j.wrist, j.wrist2];
    if (hold === 'mid') return [[(j.wrist[0] + j.wrist2[0]) / 2, (j.wrist[1] + j.wrist2[1]) / 2 - 4]];
    if (typeof hold === 'string') return [j[hold]];
    return [[j[hold[0]][0] + hold[1], j[hold[0]][1] + hold[2]]];
  }

  function loadGlyph(equipment, at, j, pattern, color) {
    const [x, y] = at;
    switch (equipment) {
      // A barbell seen end-on: a plate ring with a hub, so it never reads as a head.
      case 'barbell':
        return circle([x, y], 8, color, false, 3.5) + circle([x, y], 2.2, color, true);
      case 'smith':
        return seg([x, y - 40], [x, y + 40], color, 2) + circle([x, y], 8, color, false, 3.5) + circle([x, y], 2.2, color, true);
      case 'ez curl bar':
        return circle([x, y], 6.5, color, false, 3) + circle([x, y], 2, color, true);
      case 'dumbbell': {
        const a = j.view === 'front' ? 90 : 0;
        const p1 = step([x, y], a, 5), p2 = step([x, y], a + 180, 5);
        return seg(p1, p2, color, 3) + seg(step(p1, a + 90, 4), step(p1, a - 90, 4), color, 4.5) + seg(step(p2, a + 90, 4), step(p2, a - 90, 4), color, 4.5);
      }
      case 'kettlebell':
        return circle([x, y + 7], 5.5, color, true) + '<path d="M' + r1(x - 4) + ' ' + r1(y + 3) + ' Q' + r1(x) + ' ' + r1(y - 5) + ' ' + r1(x + 4) + ' ' + r1(y + 3) + '" fill="none" stroke="' + color + '" stroke-width="2.5"/>';
      case 'medicine ball':
        return circle([x, y], 7, color, true);
      case 'cable': case 'bands': {
        const anchor = pattern.anchor;
        if (!anchor) return '';
        const dash = equipment === 'bands' ? ' stroke-dasharray="4 3"' : '';
        return seg([x, y], anchor, color, 2, dash) + (equipment === 'cable' ? circle(anchor, 3.5, color, true) : '');
      }
      default:
        return '';
    }
  }

  function renderPattern(key, opts) {
    opts = opts || {};
    const pattern = PATTERNS[key] || PATTERNS.stand;
    const color = opts.color || '#e8e4df';
    const equipColor = opts.equipColor || EQUIP_COLOR;
    const equipment = opts.equipment || 'none';
    const j = skeleton(pattern.pose);
    const far = ' opacity="0.45"';
    let back = '', front = '', props = '';

    (pattern.props || []).forEach(p => { props += prop(p, equipColor); });

    // Far limbs first, at reduced opacity, so the near side reads on top.
    const sh2 = j.view === 'front' ? j.shoulderL : j.shoulder;
    const hp2 = j.view === 'front' ? j.hipL : j.hip;
    const farOpacity = j.view === 'front' ? '' : far;
    back += '<g' + farOpacity + '>' +
      seg(hp2, j.knee2, color, STROKE.limb) + seg(j.knee2, j.ankle2, color, STROKE.limb) + seg(j.ankle2, j.toe2, color, STROKE.limb - 2) +
      seg(sh2, j.elbow2, color, STROKE.limb) + seg(j.elbow2, j.wrist2, color, STROKE.limb) + '</g>';

    if (j.view === 'front') {
      front += seg(j.hip, j.shoulder, color, STROKE.torso) + seg(j.shoulderL, j.shoulderR, color, STROKE.limb) + seg(j.hipL, j.hipR, color, STROKE.limb);
      front += seg(j.hipR, j.knee, color, STROKE.limb) + seg(j.knee, j.ankle, color, STROKE.limb) + seg(j.ankle, j.toe, color, STROKE.limb - 2);
      front += seg(j.shoulderR, j.elbow, color, STROKE.limb) + seg(j.elbow, j.wrist, color, STROKE.limb);
    } else {
      front += seg(j.hip, j.shoulder, color, STROKE.torso);
      front += seg(j.hip, j.knee, color, STROKE.limb) + seg(j.knee, j.ankle, color, STROKE.limb) + seg(j.ankle, j.toe, color, STROKE.limb - 2);
      front += seg(j.shoulder, j.elbow, color, STROKE.limb) + seg(j.elbow, j.wrist, color, STROKE.limb);
    }
    front += circle(j.head, BONE.head, color, true);

    let load = '';
    if (pattern.load !== false && equipment !== 'none' && equipment !== 'machine') {
      let points = holdPoint(j, pattern.hold);
      if (!pattern.hold && j.view === 'front' && !['cable', 'bands'].includes(equipment)) points = [j.wrist, j.wrist2];
      if (['barbell', 'smith', 'ez curl bar', 'medicine ball'].includes(equipment) && j.view !== 'front') points = points.slice(0, 1);
      if (['barbell', 'smith', 'ez curl bar'].includes(equipment) && j.view === 'front') {
        // Front view: draw the bar across both hands instead of two plates.
        const a = points[0], b = j.wrist2;
        load += seg([b[0] - 6, b[1]], [a[0] + 6, a[1]], equipColor, 3) + seg([b[0] - 7, b[1] - 7], [b[0] - 7, b[1] + 7], equipColor, 4) + seg([a[0] + 7, a[1] - 7], [a[0] + 7, a[1] + 7], equipColor, 4);
      } else {
        points.forEach(pt => { load += loadGlyph(equipment, pt, j, pattern, equipColor); });
      }
    }
    if (pattern.band === 'knees') load += seg(j.knee2, j.knee, equipColor, 2.5, ' stroke-dasharray="4 3"');
    if (pattern.band === 'hands') load += seg(j.wrist2, j.wrist, equipColor, 2.5, ' stroke-dasharray="4 3"');

    const body = props + back + front + load;
    const size = opts.size || 24;
    const cls = opts.className ? ' class="' + opts.className + '"' : '';
    const title = opts.title ? '<title>' + String(opts.title).replace(/[<&]/g, c => (c === '<' ? '&lt;' : '&amp;')) + '</title>' : '';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="' + size + '" height="' + size + '"' + cls + ' stroke-linecap="round" stroke-linejoin="round" role="img">' +
      title + '<g transform="' + fitTransform(body) + '">' + body + '</g></svg>';
  }

  // Centre every drawing in the frame (and shrink the rare one that overflows) so
  // poses with different extents still sit consistently in a list.
  function fitTransform(svg) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const add = (x, y, pad) => {
      minX = Math.min(minX, x - pad); maxX = Math.max(maxX, x + pad);
      minY = Math.min(minY, y - pad); maxY = Math.max(maxY, y + pad);
    };
    const num = (tag, attr) => Number((tag.match(new RegExp(' ' + attr + '="(-?[0-9.]+)"')) || [])[1]);
    (svg.match(/<line [^>]*>/g) || []).forEach(t => {
      const w = num(t, 'stroke-width') / 2 || 1;
      add(num(t, 'x1'), num(t, 'y1'), w); add(num(t, 'x2'), num(t, 'y2'), w);
    });
    (svg.match(/<circle [^>]*>/g) || []).forEach(t => add(num(t, 'cx'), num(t, 'cy'), num(t, 'r') + 1.5));
    (svg.match(/<rect [^>]*>/g) || []).forEach(t => {
      add(num(t, 'x'), num(t, 'y'), 0); add(num(t, 'x') + num(t, 'width'), num(t, 'y') + num(t, 'height'), 0);
    });
    if (!isFinite(minX)) return '';
    const w = maxX - minX, h = maxY - minY;
    const k = Math.min(1.15, 96 / Math.max(w, h));
    const tx = 50 - k * (minX + w / 2), ty = 50 - k * (minY + h / 2);
    return 'translate(' + r1(tx) + ' ' + r1(ty) + ') scale(' + Math.round(k * 1000) / 1000 + ')';
  }

  const cache = new Map();
  function render(exercise, opts) {
    opts = opts || {};
    const c = classify(exercise);
    const key = c.pattern + '|' + c.equipment + '|' + (opts.color || '') + '|' + (opts.size || '') + '|' + (opts.className || '');
    if (!opts.title && cache.has(key)) return cache.get(key);
    const svg = renderPattern(c.pattern, Object.assign({}, opts, { equipment: c.equipment }));
    if (!opts.title) cache.set(key, svg);
    return svg;
  }

  return { PATTERNS, RULES, OVERRIDES, classify, render, renderPattern, skeleton };
});
