#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const MuscleProgress = require('../public/progress-engine.js');

const root = path.resolve(__dirname, '..');
const readJson = relativePath => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const excludedDates = process.argv.filter(arg => arg.startsWith('--exclude-date=')).map(arg => arg.split('=')[1]);
const excludedIds = process.argv.filter(arg => arg.startsWith('--exclude-id=')).map(arg => arg.split('=')[1]);
const savedExclusions = process.argv.includes('--include-outliers') ? [] : readJson('analysis/replay-exclusions.json');
const excludedWorkoutIds = [...new Set([...savedExclusions.map(item => item.workoutId), ...excludedIds])];
const showTrace = process.argv.includes('--trace');

const source = {
  workouts: readJson('data/workouts.json'),
  sets: readJson('data/sets.json'),
};
const exerciseDb = readJson('public/exercises.json');
const state = MuscleProgress.replayHistory(source, exerciseDb, { excludedDates, excludedWorkoutIds });
const snapshot = MuscleProgress.getProgressSnapshot(state);

if (showTrace) {
  console.log('Replay trace');
  console.log('------------');
  state.events.forEach(event => {
    const eventDate = event.date.slice(0, 10);
    if (event.skipped) {
      console.log(`${eventDate}  ${(event.presetName || 'Workout').padEnd(10)}  SKIPPED · ${event.skipReason}`);
      return;
    }
    const awards = Object.entries(event.muscleChanges)
      .filter(([, change]) => change.totalPoints > 0 || change.starChange)
      .sort((left, right) => right[1].totalPoints - left[1].totalPoints)
      .map(([group, change]) => {
        const star = change.starChange ? ` · ★${change.starChange.from}→${change.starChange.to}` : '';
        const priming = change.primingChange ? ` · baseline ${change.primingChange.to}/${change.primingChange.target}` : '';
        return `${group} +${change.totalPoints.toFixed(1)}${priming}${star}`;
      });
    console.log(`${eventDate}  ${(event.presetName || 'Workout').padEnd(10)}  ${awards.join(' | ') || 'no awards'}`);
    event.warnings.forEach(warning => console.log(`${' '.repeat(24)}⚠ ${warning}`));
  });
  console.log('');
}

console.log(`Muscle Progress Replay (${snapshot.version})`);
console.log(`Processed ${snapshot.workoutsProcessed}; skipped ${snapshot.workoutsSkipped}`);
console.log('');
console.log('Muscle       Points  Stars  Best  Prime  Current  Peak   Evidence');
console.log('-----------  ------  -----  ----  -----  -------  -----  --------');
MuscleProgress.MUSCLE_GROUPS.forEach(group => {
  const muscle = snapshot.muscles[group];
  const cells = [
    group.padEnd(11),
    muscle.points.toFixed(1).padStart(6),
    String(muscle.currentStars).padStart(5),
    String(muscle.peakStars).padStart(4),
    `${muscle.primingSessions}/${muscle.primingTarget}`.padStart(5),
    (muscle.currentIndex === null ? '—' : muscle.currentIndex.toFixed(1)).padStart(7),
    (muscle.peakIndex === null ? '—' : muscle.peakIndex.toFixed(1)).padStart(5),
    String(muscle.eligibleExercises).padStart(8),
  ];
  console.log(cells.join('  '));
});

if (snapshot.warnings.length) {
  console.log('');
  console.log('Warnings');
  snapshot.warnings.forEach(warning => console.log(`- ${warning}`));
}
