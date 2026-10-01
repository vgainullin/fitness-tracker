'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const Pictograms = require('../public/pictograms.js');

const root = path.join(__dirname, '..');
const library = JSON.parse(fs.readFileSync(path.join(root, 'public/exercises.json'), 'utf8')).exercises;
const archive = JSON.parse(fs.readFileSync(path.join(root, 'public/exercises-archive.json'), 'utf8')).exercises;
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const presetBlock = html.slice(html.indexOf('const DEFAULT_PRESETS'), html.indexOf('];', html.indexOf('const DEFAULT_PRESETS')));
const presetNames = [...presetBlock.matchAll(/exerciseName:'([^']+)'/g)].map(m => m[1]);

test('library keeps every built-in preset exercise', () => {
  const names = new Set(library.map(e => e.name));
  assert.ok(presetNames.length >= 30);
  presetNames.forEach(n => assert.ok(names.has(n), n + ' missing from library'));
});

test('trimming loses nothing: library and archive together hold every exercise once', () => {
  const all = library.concat(archive).map(e => e.name.toLowerCase());
  assert.equal(new Set(all).size, all.length);
  assert.ok(all.length >= 872);
  assert.ok(library.length >= 150 && library.length <= 300, 'library size ' + library.length);
});

test('every exercise maps to a real pose, and library exercises never fall back to a plain figure', () => {
  library.concat(archive).forEach(ex => {
    const { pattern } = Pictograms.classify(ex);
    assert.ok(Pictograms.PATTERNS[pattern], ex.name + ' -> ' + pattern);
  });
  library.forEach(ex => assert.notEqual(Pictograms.classify(ex).pattern, 'stand', ex.name));
});

test('preset exercises get the expected movement', () => {
  const expect = {
    'Barbell Bench Press': 'bench_press', 'Incline Dumbbell Press': 'incline_press', 'Standing Military Press': 'ohp',
    'Barbell Squat': 'squat', 'Leg Press': 'leg_press', 'Romanian Deadlift': 'rdl', 'Lying Leg Curls': 'leg_curl_lying',
    'Leg Extensions': 'leg_extension', 'Pullups': 'pullup', 'Wide-Grip Lat Pulldown': 'pulldown', 'Seated Cable Rows': 'row_seated',
    'Triceps Pushdown': 'pushdown', 'Side Lateral Raise': 'lateral_raise', 'Barbell Hip Thrust': 'hip_thrust', 'Face Pull': 'face_pull',
  };
  Object.entries(expect).forEach(([name, pattern]) => assert.equal(Pictograms.classify(name).pattern, pattern, name));
});

test('custom exercises fall back to their muscle group pose', () => {
  assert.equal(Pictograms.classify({ name: 'My Odd Machine', muscleGroup: 'Chest' }).pattern, 'bench_press');
  assert.equal(Pictograms.classify({ name: 'Pec Fly' }).pattern, 'fly');
});

test('render produces a self-contained svg with the requested size and colour', () => {
  const svg = Pictograms.render('Barbell Bench Press', { size: 32, color: '#d45050', title: 'A <b> & c' });
  assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 100 100" width="32" height="32"/);
  assert.match(svg, /#d45050/);
  assert.match(svg, /<title>A &lt;b> &amp; c<\/title>/);
  assert.doesNotMatch(svg, /NaN|undefined/);
  Object.keys(Pictograms.PATTERNS).forEach(k => assert.doesNotMatch(Pictograms.renderPattern(k, { equipment: 'barbell' }), /NaN|undefined/, k));
});

test('exercises you have logged leave the archive and show in the main list', () => {
  const app = loadPickerApp();
  const archivedName = archive[0].name;
  app.run(`archivedExercises = ${JSON.stringify(archive.slice(0, 3).map(e => e.name))}.map(n => toAppExercise(exerciseIndex[n.toLowerCase()]));`);
  app.run(`state.workoutHistory = [{ id: 'w1', date: new Date().toISOString(), exercises: [{ exerciseName: ${JSON.stringify(archivedName)}, sets: [] }] }]; restoreLoggedExercises();`);
  assert.ok(app.run(`state.exercises.some(e => e.name === ${JSON.stringify(archivedName)})`));
  assert.ok(!app.run(`archivedExercises.some(e => e.name === ${JSON.stringify(archivedName)})`));
  assert.equal(app.run('archivedExercises.length'), 2);
  // Running it again (e.g. after a re-sync) adds nothing twice.
  app.run('restoreLoggedExercises()');
  assert.equal(app.run(`state.exercises.filter(e => e.name === ${JSON.stringify(archivedName)}).length`), 1);
  // The picker's All view now offers it.
  app.run(`startWorkout(); openExercisePicker(); setPickerGroup('all'); showAllPickerRows();`);
  assert.ok(app.run(`picker.rows.some(r => r.name === ${JSON.stringify(archivedName)})`));
});

function loadPickerApp() {
  const vm = require('node:vm');
  const el = () => ({ textContent: '', innerHTML: '', value: '', style: {}, scrollTop: 0, addEventListener() {},
    classList: { add() {}, remove() {}, contains: () => false, toggle() {} } });
  const elements = new Map();
  const document = { getElementById: id => (elements.has(id) || elements.set(id, el()), elements.get(id)), querySelectorAll: () => [] };
  const source = [...html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.trim())[0].replace(/\ninit\(\);\s*$/, '\n');
  const context = vm.createContext({ document, console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {} });
  vm.runInContext(source, context);
  context.__lib = { exercises: library };
  context.__all = library.concat(archive);
  vm.runInContext(`
    settingsDb = { transaction() { return { objectStore() { return { put() {} }; } }; } };
    exerciseDb = { exercises: __all };
    __all.forEach(ex => { exerciseIndex[ex.name.toLowerCase()] = ex; });
    state.exercises = __lib.exercises.map(toAppExercise);
  `, context);
  return { run: code => vm.runInContext(code, context) };
}
