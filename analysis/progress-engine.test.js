'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const MP = require('../public/progress-engine.js');

const exerciseDb = {
  exercises: [
    { name: 'Bench', primary_muscles: ['chest'], secondary_muscles: ['triceps', 'shoulders'] },
    { name: 'Incline Bench', primary_muscles: ['chest'], secondary_muscles: ['triceps', 'shoulders'] },
    { name: 'Curl', primary_muscles: ['biceps'], secondary_muscles: ['forearms'] },
  ],
};

function workout(id, date, exerciseName, sets) {
  return {
    id,
    date: `${date}T12:00:00.000Z`,
    presetName: 'Test',
    durationMinutes: 30,
    exercises: [{ exerciseName, sets }],
  };
}

function set(weight, reps, effort) {
  return { weight, reps, effort };
}

test('normalizes v1 Workouts/Sets exports chronologically', () => {
  const history = MP.normalizeHistory({
    workouts: [
      { id: 'b', date: '2026-02-02', presetName: 'Two' },
      { id: 'a', date: '2026-01-01', presetName: 'One' },
    ],
    sets: [
      { workoutId: 'a', exerciseName: 'Bench', setNumber: 1, weight: '100', reps: '5', effort: 'hard' },
      { workoutId: 'b', exerciseName: 'Curl', setNumber: 1, weight: '20', reps: '10', effort: 'good' },
    ],
  });
  assert.deepEqual(history.map(item => item.id), ['a', 'b']);
  assert.equal(history[0].exercises[0].sets[0].weight, 100);
});

test('accepts an empty history for a new user', () => {
  const state = MP.replayHistory([], exerciseDb);
  const snapshot = MP.getProgressSnapshot(state);
  assert.equal(snapshot.workoutsProcessed, 0);
  assert.equal(snapshot.muscles.Chest.primingSessions, 0);
  assert.equal(snapshot.muscles.Chest.primingTarget, 3);
  assert.equal(snapshot.muscles.Chest.currentStars, 0);
});

test('normalizes flat v2 set rows into workouts', () => {
  const history = MP.normalizeHistory({sets: [
    { date: '2026-01-01', preset: 'Push', exercise: 'Bench', weight: '100', reps: '5', effort: 'hard', duration: '30' },
    { date: '2026-01-01', preset: 'Push', exercise: 'Bench', weight: '90', reps: '8', effort: 'good', duration: '30' },
  ]});
  assert.equal(history.length, 1);
  assert.equal(history[0].exercises[0].sets.length, 2);
  assert.equal(history[0].durationMinutes, 30);
});

test('feel changes capacity without rewarding hard effort directly', () => {
  const config = MP.mergeConfig({});
  const hard = MP.sessionCapacity([set(100, 10, 'hard')], config).value;
  const good = MP.sessionCapacity([set(100, 10, 'good')], config).value;
  const light = MP.sessionCapacity([set(100, 10, 'light')], config).value;
  assert.ok(hard < good && good < light);
});

test('uses versioned compound-lift overrides instead of anatomical database quirks', () => {
  const map = MP.buildExerciseMap({exercises:[
    {name:'Barbell Deadlift',primary_muscles:['lower back'],secondary_muscles:[]},
  ]});
  assert.deepEqual(map['barbell deadlift'].primary, ['Back', 'Hamstrings']);
  assert.deepEqual(map['barbell deadlift'].secondary, ['Glutes', 'Forearms']);
});

test('allocates full primary points and fractional secondary points', () => {
  const state = MP.createProgressState(exerciseDb);
  const event = MP.applyWorkout(state, workout('one', '2026-01-01', 'Bench', [
    set(100, 5, 'hard'), set(90, 8, 'good'), set(80, 10, 'good'),
  ]));
  assert.equal(event.muscleChanges.Chest.totalPoints, 3);
  assert.equal(event.muscleChanges.Triceps.totalPoints, 0.5);
  assert.equal(event.muscleChanges.Shoulders.totalPoints, 0.5);
});

test('establishes a baseline before awarding current stars', () => {
  const state = MP.createProgressState(exerciseDb);
  [100, 100, 100, 120, 120].forEach((weight, index) => {
    MP.applyWorkout(state, workout(`w${index}`, `2026-01-${String(index + 1).padStart(2, '0')}`, 'Bench', [set(weight, 5, 'hard')]));
  });
  assert.equal(state.exercises.bench.baseline, 116.66666666666667);
  assert.equal(state.muscles.Chest.currentStars, 8);
  assert.equal(state.muscles.Chest.peakStars, 8);
  assert.ok(state.muscles.Chest.currentIndex > 110);
});

test('primes a baseline with three sessions of the same primary exercise', () => {
  const state = MP.createProgressState(exerciseDb);
  const first = MP.applyWorkout(state, workout('prime-1', '2026-01-01', 'Bench', [set(100, 5, 'good')]));
  assert.equal(state.muscles.Chest.primingSessions, 1);
  assert.equal(state.muscles.Chest.primingTarget, 3);
  assert.equal(state.muscles.Chest.baselineEstablished, false);
  assert.equal(state.muscles.Chest.currentStars, 0);
  assert.equal(first.muscleChanges.Chest.primingChange.to, 1);
  assert.equal(state.muscles.Chest.points, 1);

  MP.applyWorkout(state, workout('prime-other', '2026-01-02', 'Incline Bench', [set(80, 8, 'good')]));
  assert.equal(state.muscles.Chest.primingSessions, 1);
  assert.equal(state.muscles.Chest.baselineEstablished, false);

  MP.applyWorkout(state, workout('prime-2', '2026-01-03', 'Bench', [set(100, 5, 'good')]));
  const third = MP.applyWorkout(state, workout('prime-3', '2026-01-04', 'Bench', [set(100, 5, 'good')]));
  assert.equal(state.muscles.Chest.primingSessions, 3);
  assert.equal(state.muscles.Chest.baselineEstablished, true);
  assert.equal(state.muscles.Chest.currentStars, 1);
  assert.equal(third.muscleChanges.Chest.baselineEstablished, true);
});

test('compounded star ladder has no fixed ceiling', () => {
  assert.equal(MP.starLevelForIndex(99.99), 0);
  assert.equal(MP.starLevelForIndex(100), 1);
  assert.equal(MP.starLevelForIndex(102.5), 2);
  assert.ok(MP.starLevelForIndex(200) > 5);
  assert.equal(MP.starThresholdForLevel(2), 102.5);
});

test('current stars fall with sustained decline and can be regained', () => {
  const state = MP.createProgressState(exerciseDb);
  const apply = (weight, index) => MP.applyWorkout(state, workout(`decline-${index}`, `2026-02-${String(index + 1).padStart(2, '0')}`, 'Bench', [set(weight, 5, 'hard')]));
  [100, 100, 100].forEach(apply);
  assert.equal(state.muscles.Chest.currentStars, 1);
  [80, 80].forEach((weight, index) => apply(weight, index + 3));
  assert.equal(state.muscles.Chest.currentStars, 0);
  assert.equal(state.muscles.Chest.peakStars, 1);
  [100, 100].forEach((weight, index) => apply(weight, index + 5));
  assert.equal(state.muscles.Chest.currentStars, 1);
  assert.equal(state.muscles.Chest.peakStars, 1);
});

test('rejects invalid star growth configuration', () => {
  assert.throws(() => MP.mergeConfig({starGrowthPercent:0}), /greater than zero/);
});

test('requires a meaningful baseline priming window', () => {
  assert.throws(() => MP.mergeConfig({baselineSessions:2}), /at least 3/);
});

test('skips configured outliers without affecting points or baselines', () => {
  const state = MP.createProgressState(exerciseDb, {excludedDates:['2026-01-02']});
  MP.applyWorkout(state, workout('one', '2026-01-01', 'Bench', [set(100, 5, 'hard')]));
  const excluded = MP.applyWorkout(state, workout('two', '2026-01-02', 'Bench', [set(10, 5, 'hard')]));
  assert.equal(excluded.skipped, true);
  assert.equal(state.workoutsProcessed, 1);
  assert.equal(state.exercises.bench.sessions.length, 1);
});

test('duplicate workout IDs are idempotent', () => {
  const state = MP.createProgressState(exerciseDb);
  const source = workout('same', '2026-01-01', 'Bench', [set(100, 5, 'hard')]);
  MP.applyWorkout(state, source);
  const duplicate = MP.applyWorkout(state, source);
  assert.equal(duplicate.skipped, true);
  assert.equal(state.muscles.Chest.points, 1);
});

test('full replay is deterministic', () => {
  const history = [
    workout('one', '2026-01-01', 'Bench', [set(100, 5, 'hard')]),
    workout('two', '2026-01-08', 'Bench', [set(105, 5, 'good')]),
    workout('three', '2026-01-15', 'Bench', [set(110, 5, 'hard')]),
  ];
  const left = MP.getProgressSnapshot(MP.replayHistory(history, exerciseDb));
  const right = MP.getProgressSnapshot(MP.replayHistory(history, exerciseDb));
  assert.deepEqual(left, right);
});

test('v1 and v2 histories produce the same progress snapshot', () => {
  const workouts = [1, 2, 3].map(day => ({id:`w${day}`,date:`2026-01-0${day}`,presetName:'Push',durationMinutes:30}));
  const v1Sets = [1, 2, 3].map(day => ({workoutId:`w${day}`,exerciseName:'Bench',setNumber:1,weight:100,reps:5,effort:'hard'}));
  const v2Sets = [1, 2, 3].map(day => ({date:`2026-01-0${day}`,preset:'Push',exercise:'Bench',weight:100,reps:5,effort:'hard',duration:30}));
  const v1 = MP.getProgressSnapshot(MP.replayHistory({workouts,sets:v1Sets}, exerciseDb));
  const v2 = MP.getProgressSnapshot(MP.replayHistory({sets:v2Sets}, exerciseDb));
  assert.deepEqual(v1, v2);
});
