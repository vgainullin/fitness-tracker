'use strict';

// An in-progress workout must come back on screen after a page refresh and
// after Google asks the user to sign in again. Runs the real app script with
// Google, Sheets and IndexedDB replaced by in-memory fakes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const MuscleProgress = require('../public/progress-engine.js');

const root = path.resolve(__dirname, '..');

function createElement() {
  const classes = new Set();
  return {
    textContent: '', innerHTML: '', value: '', style: {},
    classList: {
      add: (...n) => n.forEach(x => classes.add(x)),
      remove: (...n) => n.forEach(x => classes.delete(x)),
      contains: x => classes.has(x),
      toggle: (x, on) => { const v = on === undefined ? !classes.has(x) : on; v ? classes.add(x) : classes.delete(x); return v; },
    },
    addEventListener() {},
  };
}

// devices: { [accountId]: Map } stands in for each account's IndexedDB, and
// survives across "page loads" like the real one does.
function loadApp(devices, userinfo) {
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const source = [...html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)]
    .map(m => m[1]).filter(s => s.trim())[0].replace(/\ninit\(\);\s*$/, '\n');

  const elements = new Map();
  const screens = ['home', 'workout', 'progress', 'weight', 'chat', 'settings'].map(n => {
    const el = createElement(); elements.set('screen-' + n, el); return el;
  });
  const windowListeners = {};
  const document = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, createElement()); return elements.get(id); },
    querySelectorAll(sel) { return sel === '.screen' ? screens : []; },
    addEventListener() {},
    visibilityState: 'visible',
  };
  const context = vm.createContext({
    MuscleProgress, document, console, setTimeout, clearTimeout, clearInterval,
    // The workout timer must not keep the test process alive.
    setInterval: (...args) => { const t = setInterval(...args); t.unref(); return t; },
    window: { addEventListener: (name, fn) => { windowListeners[name] = fn; } },
    google: { accounts: { oauth2: { hasGrantedAllScopes: () => true, revoke() {} } } },
    __devices: devices,
    __userinfo: userinfo,
  });
  vm.runInContext(source, context, { filename: 'public/index.html' });
  vm.runInContext(`
    exerciseDb = [];
    openAccountDb = async (id) => { if (!__devices[id]) __devices[id] = new Map(); __db = __devices[id]; };
    dbGet = async (k) => __db ? __db.get(k) : undefined;
    dbSet = async (k, v) => { if (__db) __db.set(k, v === undefined ? undefined : JSON.parse(JSON.stringify(v))); };
    googleApi = async () => __userinfo();
    migrateLegacyStore = async () => {};
    ensureSpreadsheet = async () => {};
    loadDataFromSheets = async () => {};
    flushPendingWorkouts = async () => {};
    renderWeightChart = () => {}; // needs a real canvas
    var __db = null;
  `, context);
  return { context, elements, windowListeners };
}

const run = (ctx, code) => vm.runInContext(code, ctx);
const signIn = ctx => run(ctx, `onGoogleToken({ access_token: 'tok' })`);
const settle = () => new Promise(r => setTimeout(r, 0));

function startBenchWorkout(ctx) {
  run(ctx, `
    startWorkout();
    state.currentWorkout.startTime = Date.now() - 12 * 60 * 1000;
    state.currentWorkout.exercises.push({ exerciseId: 'ex_bench', exerciseName: 'Barbell Bench Press', comment: '', sets: [
      { id: 's1', weight: 100, reps: 5, effort: 'good' },
      { id: 's2', weight: 0, reps: 0, effort: '' },
    ] });
    renderWorkout();
  `);
}

const me = () => ({ sub: 'acct-1', email: 'lifter@example.com' });

test('refreshing the page brings the active workout back on screen', async () => {
  const devices = {};
  const first = loadApp(devices, me);
  await signIn(first.context);
  startBenchWorkout(first.context);
  // Typed into the second set without leaving the field, then refreshed.
  run(first.context, `updateSet(0, 1, 'weight', '102.5'); updateSet(0, 1, 'reps', '4'); updateExerciseComment(0, 'felt strong');`);
  await settle();

  const second = loadApp(devices, me);
  await signIn(second.context);

  const screen = second.elements.get('workout-exercises').innerHTML;
  assert.match(screen, /Barbell Bench Press/);
  assert.match(screen, /value="100"/);
  assert.match(screen, /value="102.5"/);
  assert.match(screen, /value="4"/);
  assert.match(screen, /felt strong/);
  assert.match(screen, /effort-btn active good/);
  assert.equal(second.elements.get('screen-workout').classList.contains('active'), true);
  assert.equal(second.elements.get('screen-home').classList.contains('active'), false);
  assert.equal(second.elements.get('workout-timer').textContent, '12:00');
});

test('set inputs save while typing, not only when the field loses focus', () => {
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  assert.match(html, /oninput="updateSet\('\+xi\+','\+si\+',\\'weight\\'/);
  assert.match(html, /oninput="updateSet\('\+xi\+','\+si\+',\\'reps\\'/);
  assert.match(html, /oninput="updateExerciseComment\(/);
});

test('session expiry and signing in again keeps the workout and its newest edits', async () => {
  const devices = {};
  const app = loadApp(devices, me);
  await signIn(app.context);
  startBenchWorkout(app.context);
  // An edit that only made it to memory (for example a write still in flight).
  run(app.context, `state.currentWorkout.exercises[0].sets[1].reps = 6;`);
  devices['acct-1'].set('currentWorkout', null);

  await signIn(app.context);
  const screen = app.elements.get('workout-exercises').innerHTML;
  assert.match(screen, /Barbell Bench Press/);
  assert.match(screen, /value="6"/);
  assert.equal(devices['acct-1'].get('currentWorkout').exercises[0].sets[1].reps, 6);
});

test('a different account signing in on the same device does not see the workout', async () => {
  const devices = {};
  const app = loadApp(devices, me);
  await signIn(app.context);
  startBenchWorkout(app.context);
  await settle();

  const other = loadApp(devices, () => ({ sub: 'acct-2', email: 'friend@example.com' }));
  await signIn(other.context);
  assert.equal(run(other.context, `state.currentWorkout`), null);
  assert.match(other.elements.get('workout-exercises').innerHTML, /No active workout/);
  // ...and the first account still has it.
  assert.equal(devices['acct-1'].get('currentWorkout').exercises[0].exerciseName, 'Barbell Bench Press');
});

test('switching to the Workout tab always draws the current workout', async () => {
  const devices = {};
  const app = loadApp(devices, me);
  await signIn(app.context);
  startBenchWorkout(app.context);
  app.elements.get('workout-exercises').innerHTML = '';
  run(app.context, `switchTab('home'); switchTab('workout');`);
  assert.match(app.elements.get('workout-exercises').innerHTML, /Barbell Bench Press/);
});

test('hiding the page writes the workout to the device', async () => {
  const devices = {};
  const app = loadApp(devices, me);
  await signIn(app.context);
  startBenchWorkout(app.context);
  run(app.context, `state.currentWorkout.exercises[0].sets[0].reps = 8;`);
  app.windowListeners.pagehide();
  await settle();
  assert.equal(devices['acct-1'].get('currentWorkout').exercises[0].sets[0].reps, 8);
});
