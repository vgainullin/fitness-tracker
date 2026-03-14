// ============================================
// IRON LOG -- Google Apps Script Backend
// ============================================
// SETUP: Run setup() once, then Deploy > Web App (Anyone)
// ============================================

const SPREADSHEET_NAME = "Gym Tracker Data";

// ---- SETUP ----

function setup() {
  const ss = getOrCreateSpreadsheet();

  let exercises = ss.getSheetByName("Exercises");
  if (!exercises) {
    exercises = ss.insertSheet("Exercises");
    exercises.appendRow(["id", "name", "muscleGroup", "createdAt"]);
    const seed = [
      ["ex_001","Barbell Bench Press","Chest"],["ex_002","Incline Dumbbell Press","Chest"],
      ["ex_003","Cable Flyes","Chest"],["ex_004","Barbell Back Squat","Legs"],
      ["ex_005","Romanian Deadlift","Legs"],["ex_006","Leg Press","Legs"],
      ["ex_007","Leg Curl","Legs"],["ex_008","Leg Extension","Legs"],
      ["ex_009","Barbell Overhead Press","Shoulders"],["ex_010","Lateral Raises","Shoulders"],
      ["ex_011","Face Pulls","Shoulders"],["ex_012","Barbell Row","Back"],
      ["ex_013","Pull Ups","Back"],["ex_014","Lat Pulldown","Back"],
      ["ex_015","Seated Cable Row","Back"],["ex_016","Barbell Curl","Arms"],
      ["ex_017","Tricep Pushdown","Arms"],["ex_018","Hammer Curl","Arms"],
      ["ex_019","Conventional Deadlift","Back"],["ex_020","Calf Raises","Legs"],
      ["ex_021","Plank","Core"],["ex_022","Cable Crunch","Core"],
      ["ex_023","Dumbbell Bench Press","Chest"],["ex_024","Bulgarian Split Squat","Legs"],
      ["ex_025","Hip Thrust","Legs"],
    ];
    seed.forEach(row => exercises.appendRow([row[0], row[1], row[2], new Date().toISOString()]));
  }

  let workouts = ss.getSheetByName("Workouts");
  if (!workouts) {
    workouts = ss.insertSheet("Workouts");
    workouts.appendRow(["id", "date", "presetName", "durationMinutes", "notes", "createdAt"]);
  }

  let sets = ss.getSheetByName("Sets");
  if (!sets) {
    sets = ss.insertSheet("Sets");
    sets.appendRow(["id", "workoutId", "exerciseId", "exerciseName", "setNumber", "weight", "reps", "effort", "timestamp"]);
  }

  let weight = ss.getSheetByName("Weight");
  if (!weight) {
    weight = ss.insertSheet("Weight");
    weight.appendRow(["id", "date", "weight", "unit", "notes", "createdAt"]);
  }

  const defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getSheets().length > 1) ss.deleteSheet(defaultSheet);

  Logger.log("Setup complete: " + ss.getUrl());
}

function getOrCreateSpreadsheet() {
  const files = DriveApp.getFilesByName(SPREADSHEET_NAME);
  if (files.hasNext()) return SpreadsheetApp.open(files.next());
  return SpreadsheetApp.create(SPREADSHEET_NAME);
}

function getSpreadsheet() {
  const files = DriveApp.getFilesByName(SPREADSHEET_NAME);
  if (!files.hasNext()) throw new Error("Run setup() first");
  return SpreadsheetApp.open(files.next());
}

// ---- WEB APP ----

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  try {
    const action = e.parameter.action;
    let body = {};
    if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    let result;
    switch (action) {
      case "ping":
        result = { ok: true, ts: new Date().toISOString() };
        break;
      case "getExercises":
        result = getExercises();
        break;
      case "addExercise":
        result = addExercise(body);
        break;
      case "syncWorkout":
        result = syncWorkout(body);
        break;
      case "getWorkouts":
        result = getWorkouts(parseInt(e.parameter.limit) || 50);
        break;
      case "getWorkoutDetail":
        result = getWorkoutDetail(e.parameter.workoutId);
        break;
      case "logWeight":
        result = logWeight(body);
        break;
      case "getWeightHistory":
        result = getWeightHistory(parseInt(e.parameter.limit) || 90);
        break;
      case "chat":
        result = proxyChat(body);
        break;
      default:
        result = { error: "Unknown action: " + action };
    }
    output.setContent(JSON.stringify(result));
  } catch (err) {
    output.setContent(JSON.stringify({ error: err.message, stack: err.stack }));
  }
  return output;
}

// ---- EXERCISES ----

function getExercises() {
  const sheet = getSpreadsheet().getSheetByName("Exercises");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  return { exercises: data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  })};
}

function addExercise(p) {
  const sheet = getSpreadsheet().getSheetByName("Exercises");
  const id = p.id || ("ex_" + Utilities.getUuid().substring(0, 8));
  sheet.appendRow([id, p.name, p.muscleGroup || "", new Date().toISOString()]);
  return { ok: true, id };
}

// ---- SYNC WORKOUT (batch -- frontend is source of truth) ----

function syncWorkout(p) {
  const ss = getSpreadsheet();
  const wSheet = ss.getSheetByName("Workouts");
  const sSheet = ss.getSheetByName("Sets");

  // Upsert workout row
  const wData = wSheet.getDataRange().getValues();
  let found = false;
  for (let i = 1; i < wData.length; i++) {
    if (wData[i][0] === p.id) {
      wSheet.getRange(i + 1, 1, 1, 6).setValues([[
        p.id, p.date, p.presetName || "", p.durationMinutes || 0, p.notes || "", wData[i][5]
      ]]);
      found = true;
      break;
    }
  }
  if (!found) {
    wSheet.appendRow([p.id, p.date, p.presetName || "", p.durationMinutes || 0, p.notes || "", new Date().toISOString()]);
  }

  // Replace all sets for this workout (delete old, write new)
  const sData = sSheet.getDataRange().getValues();
  const rowsToDelete = [];
  for (let i = sData.length - 1; i >= 1; i--) {
    if (sData[i][1] === p.id) rowsToDelete.push(i + 1);
  }
  rowsToDelete.forEach(r => sSheet.deleteRow(r));

  // Write fresh sets
  if (p.exercises && p.exercises.length) {
    const rows = [];
    p.exercises.forEach(ex => {
      (ex.sets || []).forEach((s, si) => {
        rows.push([
          s.id || (p.id + "_s" + si),
          p.id,
          ex.exerciseId,
          ex.exerciseName,
          si + 1,
          s.weight || 0,
          s.reps || 0,
          s.effort || "",
          new Date().toISOString()
        ]);
      });
    });
    if (rows.length) {
      sSheet.getRange(sSheet.getLastRow() + 1, 1, rows.length, 9).setValues(rows);
    }
  }

  return { ok: true, id: p.id };
}

// ---- WORKOUTS ----

function getWorkouts(limit) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName("Workouts");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const setsSheet = ss.getSheetByName("Sets");
  const setsData = setsSheet.getDataRange().getValues();
  const setCounts = {};
  const exerciseCounts = {};
  const exerciseNames = {};
  for (let i = 1; i < setsData.length; i++) {
    const wId = setsData[i][1];
    setCounts[wId] = (setCounts[wId] || 0) + 1;
    if (!exerciseCounts[wId]) { exerciseCounts[wId] = new Set(); exerciseNames[wId] = []; }
    if (!exerciseCounts[wId].has(setsData[i][2])) {
      exerciseCounts[wId].add(setsData[i][2]);
      exerciseNames[wId].push(setsData[i][3]);
    }
  }

  const workouts = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    obj.totalSets = setCounts[obj.id] || 0;
    obj.totalExercises = exerciseCounts[obj.id] ? exerciseCounts[obj.id].size : 0;
    obj.exerciseNames = exerciseNames[obj.id] || [];
    return obj;
  });

  return { workouts: workouts.reverse().slice(0, limit) };
}

function getWorkoutDetail(workoutId) {
  const ss = getSpreadsheet();
  const wSheet = ss.getSheetByName("Workouts");
  const wData = wSheet.getDataRange().getValues();
  const wHeaders = wData[0];
  let workout = null;
  for (let i = 1; i < wData.length; i++) {
    if (wData[i][0] === workoutId) {
      workout = {};
      wHeaders.forEach((h, j) => workout[h] = wData[i][j]);
      break;
    }
  }
  if (!workout) return { error: "Workout not found" };

  const sSheet = ss.getSheetByName("Sets");
  const sData = sSheet.getDataRange().getValues();
  const sHeaders = sData[0];
  const exercises = {};
  for (let i = 1; i < sData.length; i++) {
    if (sData[i][1] === workoutId) {
      const s = {};
      sHeaders.forEach((h, j) => s[h] = sData[i][j]);
      if (!exercises[s.exerciseId]) {
        exercises[s.exerciseId] = { exerciseId: s.exerciseId, exerciseName: s.exerciseName, sets: [] };
      }
      exercises[s.exerciseId].sets.push(s);
    }
  }
  workout.exercises = Object.values(exercises);
  return workout;
}

// ---- WEIGHT TRACKING ----

function logWeight(p) {
  const sheet = getSpreadsheet().getSheetByName("Weight");
  const id = "wt_" + Utilities.getUuid().substring(0, 8);
  sheet.appendRow([id, p.date || new Date().toISOString(), p.weight, p.unit || "kg", p.notes || "", new Date().toISOString()]);
  return { ok: true, id };
}

function getWeightHistory(limit) {
  const sheet = getSpreadsheet().getSheetByName("Weight");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const entries = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
  return { entries: entries.reverse().slice(0, limit) };
}

// ---- ANTHROPIC CHAT PROXY ----

function proxyChat(p) {
  if (!p.apiKey) return { error: "No API key provided" };
  if (!p.messages || !p.messages.length) return { error: "No messages" };

  const systemPrompt = "You are a concise, knowledgeable fitness coach inside a gym tracking app called Iron Log. " +
    "Give brief, actionable advice about exercises, form, programming, nutrition, and recovery. " +
    "Keep responses short (2-4 sentences) unless the user asks for detail.";

  const resp = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": p.apiKey,
      "anthropic-version": "2023-06-01"
    },
    payload: JSON.stringify({
      model: p.model || "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: p.messages
    }),
    muteHttpExceptions: true
  });

  const status = resp.getResponseCode();
  const body = JSON.parse(resp.getContentText());
  if (status !== 200) {
    return { error: body.error ? body.error.message : "API error " + status };
  }
  return { ok: true, content: body.content, model: body.model, usage: body.usage };
}
