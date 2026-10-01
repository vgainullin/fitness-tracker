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

function workout(date, names) {
  return { id: 'w' + date, date, exercises: names.map(n => ({ exerciseName: n, sets: [{ weight: 50, reps: 8, effort: '' }] })) };
}

const HISTORY = [
  workout('2026-09-20', ['Barbell Squat', 'Leg Press', 'Barbell Bench Press']),
  workout('2026-09-10', ['Barbell Squat', 'Barbell Bench Press', 'My Odd Machine']),
  workout('2026-09-01', ['Barbell Squat', 'Leg Press']),
  workout('2026-08-01', ['Lying Leg Curls']),
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
  // Bench and Leg Press tie on count and last date, so name breaks the tie.
  assert.deepEqual(rowNames(app), ['Barbell Squat', 'Barbell Bench Press', 'Leg Press', 'My Odd Machine', 'Lying Leg Curls']);
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
  assert.ok(names.length > 100);
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
  assert.deepEqual(runJson(app, 'state.currentWorkout.exercises.map(e => e.exerciseName)'), ['Barbell Squat', 'Barbell Bench Press']);
  assert.equal(app.run('state.currentWorkout.exercises[0].sets[0].weight'), 50);
  assert.equal(app.el('exercise-picker').classList.contains('open'), false);
  // Already-added exercises are shown as such and can't be ticked again.
  app.run('openExercisePicker(); pickExercise(0)');
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
