'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function createElement() {
  const classes = new Set();
  return {
    textContent: '',
    innerHTML: '',
    value: '',
    disabled: false,
    scrollTop: 0,
    style: {},
    classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
      toggle: name => (classes.has(name) ? (classes.delete(name), false) : (classes.add(name), true)),
    },
    addEventListener() {},
  };
}

function loadApp() {
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const source = [...html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)]
    .map(match => match[1])
    .filter(src => src.trim())[0]
    .replace(/\ninit\(\);\s*$/, '\n');
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement());
      return elements.get(id);
    },
    querySelectorAll() { return []; },
  };
  // startWorkout() starts a timer; a no-op interval keeps it from holding the test process open.
  const context = vm.createContext({ document, console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {} });
  vm.runInContext(source, context, { filename: 'public/index.html' });
  context.__db = JSON.parse(fs.readFileSync(path.join(root, 'public/exercises.json'), 'utf8'));
  vm.runInContext(`
    settingsDb = { transaction() { return { objectStore() { return { put() {} }; } }; } };
    exerciseDb = __db;
    __db.exercises.forEach(ex => { exerciseIndex[ex.name.toLowerCase()] = ex; });
    state.exercises = __db.exercises.map(ex => ({
      id: 'ex_' + ex.name.toLowerCase().replace(/[^a-z0-9]/g,'_').substring(0,30),
      name: ex.name, muscleGroup: getExerciseMuscleGroup(ex), category: ex.category,
      equipment: ex.equipment, primary_muscles: ex.primary_muscles,
    }));
  `, context);
  const run = code => vm.runInContext(code, context);
  return { run, el: id => document.getElementById(id) };
}

// Dates are relative to now so the "recent" window doesn't drift as the tests age.
function workout(daysAgo, names) {
  const date = new Date(Date.now() - daysAgo * 86400000).toISOString();
  return { id: 'w' + daysAgo, date, exercises: names.map(n => ({ exerciseName: n, sets: [{ weight: 50, reps: 8, effort: '' }] })) };
}

const HISTORY = [
  workout(10, ['Barbell Squat', 'Leg Press', 'Barbell Bench Press']),
  workout(20, ['Barbell Squat', 'Barbell Bench Press', 'My Odd Machine']),
  workout(30, ['Barbell Squat', 'Leg Press']),
  workout(60, ['Lying Leg Curls']),
];

function setup() {
  const app = loadApp();
  app.run(`state.workoutHistory = ${JSON.stringify(HISTORY)}; startWorkout();`);
  return app;
}

const runJson = (app, code) => JSON.parse(app.run('JSON.stringify(' + code + ')'));
const rowNames = app => runJson(app, 'picker.rows.map(r => r.name)');

test('picker opens on Frequent, ranked by usage count then recency', () => {
  const app = setup();
  app.run('openExercisePicker()');
  assert.equal(app.run('picker.group'), 'frequent');
  // Quads and chest were both last trained 10 days ago, so they lead as Due (quads has more
  // sessions); the rest follow by usage. Lying Leg Curls was logged once, too little to nag about.
  assert.deepEqual(rowNames(app), ['Barbell Squat', 'Leg Press', 'Barbell Bench Press', 'My Odd Machine', 'Lying Leg Curls']);
  assert.match(app.el('exercise-list').innerHTML, /Due · Quads <span class="due-days">10 days/);
  assert.match(app.el('picker-groups').innerHTML, /★ Frequent<span class="chip-count">5/);
  assert.match(app.el('exercise-list').innerHTML, /3× · /);
});

test('new users start on All since there is nothing frequent yet', () => {
  const app = loadApp();
  app.run('startWorkout(); openExercisePicker()');
  assert.equal(app.run('picker.group'), 'all');
  app.run("setPickerGroup('frequent')");
  assert.match(app.el('exercise-list').innerHTML, /Exercises you log will show up here/);
});

test('muscle group chips narrow the list, with your exercises first', () => {
  const app = setup();
  app.run("openExercisePicker(); setPickerGroup('Legs')");
  const names = rowNames(app);
  assert.deepEqual(names.slice(0, 3), ['Barbell Squat', 'Leg Press', 'Lying Leg Curls']);
  // Un-logged exercises are paged so the list stays fast; "Show all" expands it.
  assert.equal(names.length, 3 + 50);
  assert.match(app.el('exercise-list').innerHTML, /Show all \d+/);
  app.run('showAllPickerRows()');
  assert.ok(rowNames(app).length > 100);
  assert.ok(app.run("picker.rows.every(r => r.muscleGroup === 'Legs')"));
  assert.match(app.el('exercise-list').innerHTML, /Yours · Legs/);
  // Sub-muscle chips appear for the group; the most used muscle leads.
  assert.match(app.el('picker-muscles').innerHTML, /^<button class="chip" onclick="setPickerMuscle\('quads'\)">Quads/);
  app.run("setPickerMuscle('hamstrings')");
  assert.equal(rowNames(app)[0], 'Lying Leg Curls');
  assert.ok(app.run("picker.rows.every(r => r.muscle === 'hamstrings')"));
});

test('search stays in the category and falls back to everything when empty', () => {
  const app = setup();
  app.run("openExercisePicker(); setPickerGroup('Chest')");
  app.el('exercise-search').value = 'bench';
  app.run('renderExercisePicker()');
  assert.equal(rowNames(app)[0], 'Barbell Bench Press');
  assert.ok(app.run("picker.rows.every(r => r.muscleGroup === 'Chest')"));
  app.el('exercise-search').value = 'squat';
  app.run('renderExercisePicker()');
  assert.equal(rowNames(app)[0], 'Barbell Squat');
  assert.match(app.el('exercise-list').innerHTML, /Showing all exercises/);
});

test('several exercises can be ticked and added in one go, prefilled from history', () => {
  const app = setup();
  app.run('openExercisePicker()');
  app.run('pickExercise(0); pickExercise(1); pickExercise(2); pickExercise(2);');
  assert.equal(app.el('picker-add-btn').textContent, 'Add 2 exercises');
  assert.equal(app.el('picker-add-btn').disabled, false);
  app.run('addPickedExercises()');
  assert.deepEqual(runJson(app, 'state.currentWorkout.exercises.map(e => e.exerciseName)'), ['Barbell Squat', 'Leg Press']);
  assert.equal(app.run('state.currentWorkout.exercises[0].sets[0].weight'), 50);
  assert.equal(app.el('exercise-picker').classList.contains('open'), false);
  // Already-added exercises are shown as such and can't be ticked again.
  app.run("openExercisePicker(); pickExercise(picker.rows.findIndex(r => r.name === 'Barbell Squat'))");
  assert.equal(app.run('picker.selected.length'), 0);
  assert.match(app.el('exercise-list').innerHTML, /exercise-option added/);
});

test('replacing a preset exercise is still a single tap', () => {
  const app = setup();
  app.run("startFromPreset('preset_legs1'); startPresetReplace(1, 'Leg Press')");
  assert.equal(app.el('picker-title').textContent, 'Replace Exercise');
  assert.equal(app.el('picker-foot').style.display, 'none');
  app.run("setPickerGroup('Legs'); pickExercise(picker.rows.findIndex(r => r.name === 'Lying Leg Curls'))");
  assert.equal(app.run('state.currentWorkout.exercises[1].exerciseName'), 'Lying Leg Curls');
  assert.equal(app.el('exercise-picker').classList.contains('open'), false);
});

test('cancelling a replace does not turn the next add into a replace', () => {
  const app = setup();
  app.run("startFromPreset('preset_legs1'); startPresetReplace(1, 'Leg Press'); closeOverlay('exercise-picker'); openExercisePicker()");
  assert.equal(app.el('picker-title').textContent, 'Add Exercises');
  assert.equal(app.run('pendingPresetReplace'), null);
});

test('exercises from your presets lead the ones you have never logged', () => {
  const app = loadApp();
  app.run("startWorkout(); openExercisePicker(); setPickerGroup('Legs')");
  const names = rowNames(app);
  const presetLegs = [...new Set(runJson(app, "state.presets.flatMap(p => p.exercises.map(e => e.exerciseName)).filter(n => picker.rows.some(r => r.name === n))"))];
  assert.ok(presetLegs.length >= 5);
  assert.deepEqual(names.slice(0, presetLegs.length).sort(), presetLegs.sort());
});

test('lifts you stopped doing drop below your current ones', () => {
  const app = loadApp();
  // Same muscle (quads, trained today so not Due): the recent lift outranks the once-frequent one.
  const old = Array.from({ length: 6 }, (_, i) => workout(200 + i * 7, ['Barbell Squat']));
  const recent = [workout(0, ['Leg Press']), workout(2, ['Leg Press'])];
  app.run(`state.workoutHistory = ${JSON.stringify(recent.concat(old))}; startWorkout(); openExercisePicker();`);
  assert.deepEqual(rowNames(app), ['Leg Press', 'Barbell Squat']);
});

test('replace opens on the muscle of the exercise being replaced', () => {
  const app = setup();
  app.run("startFromPreset('preset_legs1'); startPresetReplace(2, 'Romanian Deadlift')");
  assert.equal(app.run('picker.group'), 'Legs');
  assert.equal(app.run('picker.muscle'), 'hamstrings');
  assert.equal(rowNames(app)[0], 'Lying Leg Curls');
});

test('Due suggests your exercises for the muscles you have neglected longest', () => {
  const app = loadApp();
  const history = [
    workout(1, ['Barbell Squat', 'Leg Press']), workout(4, ['Barbell Squat']),
    workout(2, ['Barbell Bench Press']), workout(9, ['Barbell Bench Press']),
    workout(15, ['Wide-Grip Lat Pulldown', 'Seated Cable Rows']), workout(22, ['Wide-Grip Lat Pulldown', 'Seated Cable Rows']),
    workout(30, ['Barbell Deadlift']), workout(40, ['Barbell Deadlift']),
    workout(50, ['Side Lateral Raise']),
  ];
  app.run(`state.workoutHistory = ${JSON.stringify(history)}; startWorkout(); openExercisePicker();`);
  const due = runJson(app, 'getDueMuscles(getPickerCandidates(), new Set()).map(m => [m.muscle, m.days, m.exercises.map(e => e.name)])');
  // Shoulders: one session only, ignored. Quads/chest: trained within 3 days, not due.
  assert.deepEqual(due, [
    ['lower back', 30, ['Barbell Deadlift']],
    ['lats', 15, ['Wide-Grip Lat Pulldown']],
    ['middle back', 15, ['Seated Cable Rows']],
  ]);
  assert.deepEqual(rowNames(app).slice(0, 3), ['Barbell Deadlift', 'Wide-Grip Lat Pulldown', 'Seated Cable Rows']);
  // A muscle already in this workout drops out of Due; "More" jumps to that muscle's full list.
  app.run("pickExercise(0); addPickedExercises(); openExercisePicker()");
  assert.equal(rowNames(app)[0], 'Wide-Grip Lat Pulldown');
  app.run("showPickerMuscle('Back', 'lats')");
  assert.equal(app.run('picker.group + \'/\' + picker.muscle'), 'Back/lats');
  // Searching hides Due.
  app.el('exercise-search').value = 'press';
  app.run('setPickerGroup(\'frequent\')');
  assert.doesNotMatch(app.el('exercise-list').innerHTML, /Due ·/);
});
