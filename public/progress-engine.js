(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MuscleProgress = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 'muscle-progress-v3';

  const MUSCLE_GROUPS = [
    'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms',
    'Core', 'Quads', 'Hamstrings', 'Glutes', 'Calves',
  ];

  const RAW_MUSCLE_MAP = {
    chest: 'Chest',
    lats: 'Back',
    'middle back': 'Back',
    traps: 'Back',
    shoulders: 'Shoulders',
    neck: 'Shoulders',
    biceps: 'Biceps',
    brachialis: 'Biceps',
    triceps: 'Triceps',
    forearms: 'Forearms',
    abs: 'Core',
    'lower back': 'Core',
    quads: 'Quads',
    hamstrings: 'Hamstrings',
    glutes: 'Glutes',
    abductors: 'Glutes',
    adductors: 'Glutes',
    calves: 'Calves',
  };

  // Versioned corrections and custom exercises. The source exercise database is useful
  // for discovery but sometimes classifies compounds by a single anatomical muscle.
  const EXERCISE_MUSCLE_OVERRIDES = {
    'barbell deadlift': { primary: ['Back', 'Hamstrings'], secondary: ['Glutes', 'Forearms'] },
    'romanian deadlift': { primary: ['Hamstrings'], secondary: ['Glutes', 'Back'] },
    'barbell hip thrust': { primary: ['Glutes'], secondary: ['Hamstrings'] },
    'overhead arm extension - cable': { primary: ['Triceps'], secondary: [] },
    'bicep side curl - standing': { primary: ['Biceps'], secondary: ['Forearms'] },
    'cable flyes': { primary: ['Chest'], secondary: ['Shoulders'] },
    'pec fly': { primary: ['Chest'], secondary: [] },
  };

  const DEFAULT_CONFIG = {
    version: VERSION,
    baselineSessions: 3,
    smoothingSessions: 3,
    capacityTopSets: 2,
    maxStrengthReps: 12,
    feelRir: { hard: 0, good: 2, light: 4, missing: 1 },
    primarySetPoints: 1,
    secondarySetPoints: 0.3,
    maxBasePointsPerMusclePerWorkout: 6,
    maintenanceThreshold: 0.95,
    maintenanceBonus: 1,
    improvementFloor: 0.01,
    improvementPointsPerPercent: 1,
    maxImprovementBonus: 10,
    starGrowthPercent: 2.5,
    excludedWorkoutIds: [],
    excludedDates: [],
  };

  function mergeConfig(config) {
    const merged = Object.assign({}, DEFAULT_CONFIG, config || {});
    merged.feelRir = Object.assign({}, DEFAULT_CONFIG.feelRir, (config || {}).feelRir || {});
    merged.excludedWorkoutIds = [...(merged.excludedWorkoutIds || [])];
    merged.excludedDates = [...(merged.excludedDates || [])];
    merged.baselineSessions = Number(merged.baselineSessions);
    if (!Number.isInteger(merged.baselineSessions) || merged.baselineSessions < 3) {
      throw new RangeError('baselineSessions must be an integer of at least 3');
    }
    merged.starGrowthPercent = Number(merged.starGrowthPercent);
    if (!Number.isFinite(merged.starGrowthPercent) || merged.starGrowthPercent <= 0) {
      throw new RangeError('starGrowthPercent must be greater than zero');
    }
    return merged;
  }

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function round(value, places) {
    const factor = 10 ** (places === undefined ? 2 : places);
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  function median(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function geometricMean(values) {
    const usable = values.filter(value => Number.isFinite(value) && value > 0);
    if (!usable.length) return null;
    return Math.exp(usable.reduce((sum, value) => sum + Math.log(value), 0) / usable.length);
  }

  function starLevelForIndex(index, config) {
    if (!Number.isFinite(index) || index < 100) return 0;
    const growth = Math.log1p(mergeConfig(config).starGrowthPercent / 100);
    return 1 + Math.floor(Math.log(index / 100) / growth + 1e-10);
  }

  function starThresholdForLevel(level, config) {
    if (!Number.isInteger(level) || level < 1) return null;
    const growth = 1 + mergeConfig(config).starGrowthPercent / 100;
    return round(100 * growth ** (level - 1), 10);
  }

  function stableHash(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function normalizedDate(value) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  function dateKey(value) {
    const normalized = normalizedDate(value);
    return normalized ? normalized.slice(0, 10) : '';
  }

  function normalizeSet(set) {
    return {
      id: set.id || '',
      setNumber: number(set.setNumber || set.set_number),
      weight: number(set.weight),
      reps: number(set.reps),
      effort: String(set.effort || '').trim().toLowerCase(),
    };
  }

  function normalizeNestedWorkout(workout, index) {
    const exercises = (workout.exercises || []).map(exercise => ({
      exerciseId: exercise.exerciseId || exercise.exercise_id || '',
      exerciseName: exercise.exerciseName || exercise.exercise || exercise.name || 'Unknown exercise',
      sets: (exercise.sets || []).map(normalizeSet),
    }));
    const date = normalizedDate(workout.date) || new Date(0).toISOString();
    const signature = `${date}|${workout.presetName || workout.preset || ''}|${index}`;
    return {
      id: workout.id || `wk_replay_${stableHash(signature)}`,
      date,
      presetName: workout.presetName || workout.preset || '',
      durationMinutes: number(workout.durationMinutes || workout.duration),
      notes: workout.notes || '',
      exercises,
    };
  }

  function normalizeV1(workouts, sets) {
    const byWorkout = new Map();
    (workouts || []).forEach((workout, index) => {
      const date = normalizedDate(workout.date) || new Date(0).toISOString();
      byWorkout.set(workout.id, {
        id: workout.id || `wk_replay_${stableHash(`${date}|${index}`)}`,
        date,
        presetName: workout.presetName || workout.preset || '',
        durationMinutes: number(workout.durationMinutes || workout.duration),
        notes: workout.notes || '',
        exercises: [],
        _exerciseMap: new Map(),
      });
    });

    (sets || []).forEach(row => {
      const workout = byWorkout.get(row.workoutId || row.workout_id);
      if (!workout) return;
      const name = row.exerciseName || row.exercise || 'Unknown exercise';
      const key = row.exerciseId || row.exercise_id || name.toLowerCase();
      if (!workout._exerciseMap.has(key)) {
        const exercise = { exerciseId: row.exerciseId || row.exercise_id || '', exerciseName: name, sets: [] };
        workout._exerciseMap.set(key, exercise);
        workout.exercises.push(exercise);
      }
      workout._exerciseMap.get(key).sets.push(normalizeSet(row));
    });

    return [...byWorkout.values()].map(workout => {
      delete workout._exerciseMap;
      workout.exercises.forEach(exercise => exercise.sets.sort((a, b) => a.setNumber - b.setNumber));
      return workout;
    });
  }

  function normalizeV2(sets) {
    const grouped = new Map();
    (sets || []).forEach((row, index) => {
      const day = dateKey(row.date);
      if (!day) return;
      const preset = row.preset || row.presetName || '';
      const key = `${day}|${preset}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: `wk_v2_${stableHash(key)}`,
          date: normalizedDate(row.date),
          presetName: preset,
          durationMinutes: number(row.duration || row.durationMinutes),
          notes: row.notes || '',
          exercises: [],
          _exerciseMap: new Map(),
        });
      }
      const workout = grouped.get(key);
      workout.durationMinutes = Math.max(workout.durationMinutes, number(row.duration || row.durationMinutes));
      const name = row.exercise || row.exerciseName || 'Unknown exercise';
      if (!workout._exerciseMap.has(name)) {
        const exercise = { exerciseId: '', exerciseName: name, sets: [] };
        workout._exerciseMap.set(name, exercise);
        workout.exercises.push(exercise);
      }
      workout._exerciseMap.get(name).sets.push(normalizeSet(Object.assign({ setNumber: index + 1 }, row)));
    });
    return [...grouped.values()].map(workout => {
      delete workout._exerciseMap;
      return workout;
    });
  }

  function normalizeHistory(source, maybeSets) {
    if (Array.isArray(source) && (source.length === 0 || source.some(workout => Array.isArray(workout.exercises)))) {
      return source.map(normalizeNestedWorkout).sort(compareWorkouts);
    }
    if (Array.isArray(source) && Array.isArray(maybeSets)) {
      return normalizeV1(source, maybeSets).sort(compareWorkouts);
    }
    if (source && Array.isArray(source.workouts) && Array.isArray(source.sets)) {
      const isV1 = source.sets.some(set => set.workoutId || set.workout_id);
      return (isV1 ? normalizeV1(source.workouts, source.sets) : normalizeV2(source.sets)).sort(compareWorkouts);
    }
    if (source && Array.isArray(source.sets)) {
      return normalizeV2(source.sets).sort(compareWorkouts);
    }
    throw new Error('Unsupported workout history format');
  }

  function compareWorkouts(left, right) {
    const dateDifference = new Date(left.date) - new Date(right.date);
    return dateDifference || String(left.id).localeCompare(String(right.id));
  }

  function fallbackMuscles(exerciseName) {
    const name = String(exerciseName || '').toLowerCase();
    const rules = [
      [/(bench|chest|pec|fly|crossover)/, 'Chest'],
      [/(pulldown|pullup|pull-up|\brow\b|deadlift|t-bar)/, 'Back'],
      [/(shoulder|military|lateral raise|arnold)/, 'Shoulders'],
      [/(tricep|pushdown|overhead extension)/, 'Triceps'],
      [/(bicep|\bcurl\b|preacher)/, 'Biceps'],
      [/(forearm|wrist curl)/, 'Forearms'],
      [/(ab |abs|crunch|plank|sit-up|situp)/, 'Core'],
      [/(hamstring|leg curl|romanian)/, 'Hamstrings'],
      [/(hip thrust|glute|abductor|adductor)/, 'Glutes'],
      [/(calf)/, 'Calves'],
      [/(squat|leg press|lunge|leg extension)/, 'Quads'],
    ];
    const match = rules.find(([pattern]) => pattern.test(name));
    return match ? { primary: [match[1]], secondary: [], inferred: true } : { primary: [], secondary: [], inferred: true };
  }

  function buildExerciseMap(exerciseDb) {
    const exercises = Array.isArray(exerciseDb) ? exerciseDb : (exerciseDb && exerciseDb.exercises) || [];
    const result = {};
    exercises.forEach(exercise => {
      const primary = [...new Set((exercise.primary_muscles || []).map(muscle => RAW_MUSCLE_MAP[String(muscle).toLowerCase()]).filter(Boolean))];
      const secondary = [...new Set((exercise.secondary_muscles || []).map(muscle => RAW_MUSCLE_MAP[String(muscle).toLowerCase()]).filter(group => group && !primary.includes(group)))];
      result[String(exercise.name || '').toLowerCase()] = { primary, secondary, inferred: false };
    });
    Object.entries(EXERCISE_MUSCLE_OVERRIDES).forEach(([name, muscles]) => {
      result[name] = { primary: [...muscles.primary], secondary: [...muscles.secondary], inferred: false };
    });
    return result;
  }

  function resolveMuscles(state, exerciseName) {
    return state._exerciseMap[String(exerciseName || '').toLowerCase()] || fallbackMuscles(exerciseName);
  }

  function validWorkingSets(sets) {
    return (sets || []).map(normalizeSet).filter(set => set.weight > 0 && set.reps > 0);
  }

  function sessionCapacity(sets, config) {
    const valid = validWorkingSets(sets);
    if (!valid.length) return null;
    let eligible = valid.filter(set => set.reps <= config.maxStrengthReps);
    const usedHighRepFallback = eligible.length === 0;
    if (usedHighRepFallback) eligible = valid;
    const capacities = eligible.map(set => {
      const effort = Object.prototype.hasOwnProperty.call(config.feelRir, set.effort) ? set.effort : 'missing';
      const reps = Math.min(set.reps, config.maxStrengthReps);
      return set.weight * (1 + (reps + config.feelRir[effort]) / 30);
    }).sort((a, b) => b - a);
    const take = capacities.slice(0, Math.min(config.capacityTopSets, capacities.length));
    return {
      value: take.reduce((sum, value) => sum + value, 0) / take.length,
      validSetCount: valid.length,
      scoredSetCount: eligible.length,
      usedHighRepFallback,
    };
  }

  function emptyMuscleState(name) {
    return {
      name,
      points: 0,
      currentStars: 0,
      peakStars: 0,
      currentIndex: null,
      peakIndex: null,
      eligibleExercises: 0,
      baselineEstablished: false,
      primingSessions: 0,
      primingTarget: 0,
      primingExercise: null,
      lastTrained: null,
      timeline: [],
    };
  }

  function createProgressState(exerciseDb, config) {
    const mergedConfig = mergeConfig(config);
    const muscles = {};
    MUSCLE_GROUPS.forEach(group => {
      muscles[group] = emptyMuscleState(group);
      muscles[group].primingTarget = mergedConfig.baselineSessions;
    });
    return {
      version: VERSION,
      config: mergedConfig,
      muscles,
      exercises: {},
      events: [],
      warnings: [],
      workoutsProcessed: 0,
      workoutsSkipped: 0,
      _seenWorkoutIds: {},
      _exerciseMap: buildExerciseMap(exerciseDb),
    };
  }

  function addReason(eventGroup, reason) {
    if (!eventGroup.reasons.includes(reason)) eventGroup.reasons.push(reason);
  }

  function eventGroup(event, group) {
    if (!event.muscleChanges[group]) {
      event.muscleChanges[group] = { basePoints: 0, bonusPoints: 0, totalPoints: 0, starChange: null, primingChange: null, baselineEstablished: false, reasons: [] };
    }
    return event.muscleChanges[group];
  }

  function exerciseState(state, name, muscles) {
    const key = String(name).toLowerCase();
    if (!state.exercises[key]) {
      state.exercises[key] = {
        exerciseName: name,
        primary: [...muscles.primary],
        secondary: [...muscles.secondary],
        inferredMuscles: muscles.inferred,
        sessions: [],
        baseline: null,
        currentCapacity: null,
        currentIndex: null,
        peakCapacity: null,
      };
    }
    return state.exercises[key];
  }

  function refreshExerciseStats(exercise, config) {
    const capacities = exercise.sessions.map(session => session.capacity);
    if (capacities.length >= config.baselineSessions && exercise.baseline === null) {
      exercise.baseline = median(capacities.slice(0, config.baselineSessions));
    }
    const window = capacities.slice(-config.smoothingSessions);
    exercise.currentCapacity = median(window);
    exercise.peakCapacity = Math.max(...capacities);
    exercise.currentIndex = exercise.baseline ? 100 * exercise.currentCapacity / exercise.baseline : null;
  }

  function refreshMuscleIndices(state, event) {
    MUSCLE_GROUPS.forEach(group => {
      const primaryExercises = Object.values(state.exercises).filter(exercise => exercise.primary.includes(group));
      const contributors = primaryExercises.filter(exercise => exercise.currentIndex !== null);
      const muscle = state.muscles[group];
      const previousPrimingSessions = muscle.primingSessions;
      const wasEstablished = muscle.baselineEstablished;
      const primingExercise = primaryExercises
        .filter(exercise => exercise.sessions.length)
        .sort((left, right) => right.sessions.length - left.sessions.length || left.exerciseName.localeCompare(right.exerciseName))[0] || null;
      muscle.primingSessions = primingExercise ? Math.min(state.config.baselineSessions, primingExercise.sessions.length) : 0;
      muscle.primingTarget = state.config.baselineSessions;
      muscle.primingExercise = primingExercise ? primingExercise.exerciseName : null;
      muscle.baselineEstablished = contributors.length > 0;
      if (muscle.primingSessions > previousPrimingSessions) {
        const groupEvent = eventGroup(event, group);
        groupEvent.primingChange = {
          from: previousPrimingSessions,
          to: muscle.primingSessions,
          target: muscle.primingTarget,
          exerciseName: muscle.primingExercise,
        };
        addReason(groupEvent, `baseline priming ${muscle.primingSessions}/${muscle.primingTarget} with ${muscle.primingExercise}`);
      }
      if (muscle.baselineEstablished && !wasEstablished) {
        const groupEvent = eventGroup(event, group);
        groupEvent.baselineEstablished = true;
        addReason(groupEvent, `baseline established from ${muscle.primingTarget} ${muscle.primingExercise} sessions`);
      }
      const index = geometricMean(contributors.map(exercise => exercise.currentIndex));
      muscle.currentIndex = index === null ? null : round(index, 2);
      muscle.eligibleExercises = contributors.length;
      if (index !== null) {
        muscle.peakIndex = muscle.peakIndex === null ? round(index, 2) : round(Math.max(muscle.peakIndex, index), 2);
        const previousStars = muscle.currentStars;
        const currentStars = starLevelForIndex(index, state.config);
        muscle.currentStars = currentStars;
        muscle.peakStars = Math.max(muscle.peakStars, currentStars);
        if (currentStars !== previousStars) {
          const change = { from: previousStars, to: currentStars };
          const groupEvent = eventGroup(event, group);
          groupEvent.starChange = change;
          addReason(groupEvent, `star level ${change.from} → ${change.to} at strength index ${round(index, 1)}`);
        }
      }
    });
  }

  function applyWorkout(state, workout) {
    const config = state.config;
    const normalized = normalizeNestedWorkout(workout, state.workoutsProcessed + state.workoutsSkipped);
    const day = dateKey(normalized.date);
    const event = {
      workoutId: normalized.id,
      date: normalized.date,
      presetName: normalized.presetName,
      durationMinutes: normalized.durationMinutes,
      skipped: false,
      skipReason: '',
      muscleChanges: {},
      exerciseChanges: [],
      warnings: [],
    };

    if (state._seenWorkoutIds[normalized.id]) {
      event.skipped = true;
      event.skipReason = 'duplicate workout id';
    } else if (config.excludedWorkoutIds.includes(normalized.id) || config.excludedDates.includes(day)) {
      event.skipped = true;
      event.skipReason = 'excluded by replay configuration';
    }
    state._seenWorkoutIds[normalized.id] = true;
    if (event.skipped) {
      state.workoutsSkipped += 1;
      state.events.push(event);
      return event;
    }

    if (normalized.durationMinutes < 10) {
      const warning = `Suspicious short or missing workout ${day} (${normalized.durationMinutes} minutes)`;
      event.warnings.push(warning);
      if (!state.warnings.includes(warning)) state.warnings.push(warning);
    } else if (normalized.durationMinutes >= 300) {
      const warning = `Suspicious long workout ${day} (${normalized.durationMinutes} minutes)`;
      event.warnings.push(warning);
      if (!state.warnings.includes(warning)) state.warnings.push(warning);
    }

    const basePointTotals = {};
    normalized.exercises.forEach(exercise => {
      const validSets = validWorkingSets(exercise.sets);
      if (!validSets.length) return;
      const muscles = resolveMuscles(state, exercise.exerciseName);
      if (!muscles.primary.length) {
        const warning = `No muscle mapping for ${exercise.exerciseName}`;
        event.warnings.push(warning);
        if (!state.warnings.includes(warning)) state.warnings.push(warning);
        return;
      }
      if (muscles.inferred) {
        const warning = `Inferred muscle mapping for ${exercise.exerciseName}: ${muscles.primary.join(', ')}`;
        event.warnings.push(warning);
        if (!state.warnings.includes(warning)) state.warnings.push(warning);
      }

      muscles.primary.forEach(group => {
        basePointTotals[group] = (basePointTotals[group] || 0) + validSets.length * config.primarySetPoints / muscles.primary.length;
        addReason(eventGroup(event, group), `${validSets.length} working set${validSets.length === 1 ? '' : 's'} from ${exercise.exerciseName}`);
      });
      muscles.secondary.forEach(group => {
        basePointTotals[group] = (basePointTotals[group] || 0) + validSets.length * config.secondarySetPoints / Math.max(1, muscles.secondary.length);
        addReason(eventGroup(event, group), `secondary work from ${exercise.exerciseName}`);
      });

      const capacity = sessionCapacity(validSets, config);
      if (!capacity) return;
      const tracked = exerciseState(state, exercise.exerciseName, muscles);
      const previousPeak = tracked.sessions.length ? Math.max(...tracked.sessions.map(session => session.capacity)) : null;
      tracked.sessions.push({ workoutId: normalized.id, date: normalized.date, capacity: capacity.value });
      refreshExerciseStats(tracked, config);

      const exerciseChange = {
        exerciseName: exercise.exerciseName,
        capacity: round(capacity.value, 2),
        baseline: tracked.baseline === null ? null : round(tracked.baseline, 2),
        index: tracked.currentIndex === null ? null : round(tracked.currentIndex, 2),
        validSets: capacity.validSetCount,
        usedHighRepFallback: capacity.usedHighRepFallback,
        primary: [...muscles.primary],
        secondary: [...muscles.secondary],
      };
      event.exerciseChanges.push(exerciseChange);

      if (capacity.usedHighRepFallback) {
        event.warnings.push(`${exercise.exerciseName} capacity used a high-rep fallback`);
      }

      if (tracked.baseline !== null && tracked.sessions.length > config.baselineSessions) {
        muscles.primary.forEach(group => {
          const groupEvent = eventGroup(event, group);
          if (capacity.value >= tracked.baseline * config.maintenanceThreshold) {
            groupEvent.bonusPoints += config.maintenanceBonus / muscles.primary.length;
            addReason(groupEvent, `${exercise.exerciseName} maintained ≥${Math.round(config.maintenanceThreshold * 100)}% of baseline`);
          }
          if (previousPeak && capacity.value >= previousPeak * (1 + config.improvementFloor)) {
            const improvementPct = (capacity.value / previousPeak - 1) * 100;
            const bonus = Math.min(config.maxImprovementBonus, Math.max(1, Math.round(improvementPct * config.improvementPointsPerPercent)));
            groupEvent.bonusPoints += bonus / muscles.primary.length;
            addReason(groupEvent, `${exercise.exerciseName} improved ${round(improvementPct, 1)}% (+${bonus} bonus)`);
          }
        });
      }
    });

    Object.entries(basePointTotals).forEach(([group, points]) => {
      eventGroup(event, group).basePoints = Math.min(points, config.maxBasePointsPerMusclePerWorkout);
    });

    refreshMuscleIndices(state, event);

    MUSCLE_GROUPS.forEach(group => {
      const muscle = state.muscles[group];
      const change = event.muscleChanges[group];
      if (change) {
        change.basePoints = round(change.basePoints, 1);
        change.bonusPoints = round(change.bonusPoints, 1);
        change.totalPoints = round(change.basePoints + change.bonusPoints, 1);
        muscle.points = round(muscle.points + change.totalPoints, 1);
        if (change.totalPoints > 0) muscle.lastTrained = normalized.date;
      }
      muscle.timeline.push({
        workoutId: normalized.id,
        date: normalized.date,
        points: muscle.points,
        currentStars: muscle.currentStars,
        peakStars: muscle.peakStars,
        baselineEstablished: muscle.baselineEstablished,
        primingSessions: muscle.primingSessions,
        primingTarget: muscle.primingTarget,
        primingExercise: muscle.primingExercise,
        currentIndex: muscle.currentIndex,
        peakIndex: muscle.peakIndex,
        deltaPoints: change ? change.totalPoints : 0,
      });
    });

    state.workoutsProcessed += 1;
    state.events.push(event);
    return event;
  }

  function replayHistory(history, exerciseDb, config) {
    const normalized = normalizeHistory(history);
    const state = createProgressState(exerciseDb, config);
    normalized.forEach(workout => applyWorkout(state, workout));
    return state;
  }

  function getProgressSnapshot(state) {
    const muscles = {};
    MUSCLE_GROUPS.forEach(group => {
      const source = state.muscles[group];
      muscles[group] = {
        name: group,
        points: source.points,
        currentStars: source.currentStars,
        peakStars: source.peakStars,
        baselineEstablished: source.baselineEstablished,
        primingSessions: source.primingSessions,
        primingTarget: source.primingTarget,
        primingExercise: source.primingExercise,
        currentIndex: source.currentIndex,
        peakIndex: source.peakIndex,
        eligibleExercises: source.eligibleExercises,
        lastTrained: source.lastTrained,
      };
    });
    return {
      version: state.version,
      workoutsProcessed: state.workoutsProcessed,
      workoutsSkipped: state.workoutsSkipped,
      muscles,
      warnings: [...state.warnings],
    };
  }

  return {
    VERSION,
    MUSCLE_GROUPS,
    RAW_MUSCLE_MAP,
    EXERCISE_MUSCLE_OVERRIDES,
    DEFAULT_CONFIG,
    mergeConfig,
    normalizeHistory,
    buildExerciseMap,
    sessionCapacity,
    starLevelForIndex,
    starThresholdForLevel,
    createProgressState,
    applyWorkout,
    replayHistory,
    getProgressSnapshot,
  };
});
