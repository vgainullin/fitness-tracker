'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const MuscleProgress = require('../public/progress-engine.js');

const root = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function createElement() {
  const classes = new Set();
  return {
    textContent: '',
    innerHTML: '',
    value: '',
    style: {},
    classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
    },
    addEventListener() {},
  };
}

function loadProductionApp() {
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const inlineScripts = [...html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)]
    .map(match => match[1])
    .filter(source => source.trim());
  assert.equal(inlineScripts.length, 1);

  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement());
      return elements.get(id);
    },
    querySelectorAll() { return []; },
  };
  const context = vm.createContext({
    MuscleProgress,
    document,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  });
  const source = inlineScripts[0].replace(/\ninit\(\);\s*$/, '\n');
  vm.runInContext(source, context, { filename: 'public/index.html' });
  return { context, elements, html };
}

test('production app renders historical muscle progress and workout awards', () => {
  const { context, elements } = loadProductionApp();
  const history = MuscleProgress.normalizeHistory({
    workouts: readJson('data/workouts.json'),
    sets: readJson('data/sets.json'),
  });
  const exerciseDb = readJson('public/exercises.json');
  context.__history = history;
  context.__exerciseDb = exerciseDb;

  vm.runInContext(`
    state.workoutHistory = __history;
    exerciseDb = __exerciseDb;
    rebuildMuscleProgress();
    renderHistoryProgressStatus();
    renderHistory();
    showProgressAwards(state.muscleProgress.events.find(event => !event.skipped && Object.keys(event.muscleChanges).length));
    const starEvent = state.muscleProgress.events.find(event => Object.values(event.muscleChanges).some(change => change.starChange));
    showWorkoutDetail(state.workoutHistory.findIndex(workout => workout.id === starEvent.workoutId));
  `, context);

  const widget = elements.get('history-progress-status').innerHTML;
  assert.match(widget, /muscle-progress-v3/);
  assert.equal((widget.match(/class="history-progress-chip"/g) || []).length, MuscleProgress.MUSCLE_GROUPS.length);
  assert.match(widget, /\d+ pts/);
  assert.match(widget, /\d+\/11<\/strong> primed/);
  assert.ok(elements.get('progress-award-list').innerHTML.includes('award-points'));
  assert.equal(elements.get('progress-award-overlay').classList.contains('open'), true);
  const historyList = elements.get('history-list').innerHTML;
  assert.match(historyList, /history-progress-awards/);
  assert.match(historyList, /history-earned-points">\+\d+\.\d pts/);
  assert.match(historyList, /history-muscle-deltas/);
  assert.match(historyList, /★\d+→\d+/);
  const detail = elements.get('workout-detail-content').innerHTML;
  assert.match(detail, /history-progress-awards/);
  assert.match(detail, /history-earned-points/);
  assert.match(detail, /history-award-tag/);
});

test('production app combines muscle status and exercise history in Progress', () => {
  const { html } = loadProductionApp();
  assert.doesNotMatch(html, /lootbox|Claim Rewards|inventory-overlay/i);
  assert.doesNotMatch(html, /id="screen-history"/);
  assert.match(html, /id="screen-progress"/);
  assert.match(html, /id="history-progress-status"/);
  assert.match(html, />Exercise history<\/h3>/);
  assert.match(html, /switchTab\('progress', this\)/);
  assert.match(html, /src="progress-engine\.js"/);
});

test('zero-history users see explicit baseline priming before stars', () => {
  const { context, elements } = loadProductionApp();
  context.__exerciseDb = readJson('public/exercises.json');
  context.__firstWorkout = {
    id: 'new-user-1',
    date: '2026-07-17T12:00:00.000Z',
    presetName: 'Push',
    durationMinutes: 30,
    exercises: [{exerciseName:'Barbell Bench Press', sets:[{weight:100,reps:5,effort:'good'}]}],
  };

  vm.runInContext(`
    state.workoutHistory = [];
    exerciseDb = __exerciseDb;
    rebuildMuscleProgress();
    renderHistoryProgressStatus();
  `, context);
  const emptyWidget = elements.get('history-progress-status').innerHTML;
  assert.match(emptyWidget, /<strong>0<\/strong> stars/);
  assert.match(emptyWidget, /<strong>0\/11<\/strong> primed/);
  assert.match(emptyWidget, /points count immediately/i);
  assert.equal((emptyWidget.match(/status priming">0\/3/g) || []).length, MuscleProgress.MUSCLE_GROUPS.length);

  vm.runInContext(`
    const firstEvent = scoreWorkoutProgress(__firstWorkout);
    renderHistoryProgressStatus();
    showProgressAwards(firstEvent);
  `, context);
  const firstWidget = elements.get('history-progress-status').innerHTML;
  assert.match(firstWidget, /<strong>0<\/strong> stars/);
  assert.match(firstWidget, /status priming">1\/3/);
  assert.match(elements.get('progress-award-list').innerHTML, /Baseline 1\/3/);
});
