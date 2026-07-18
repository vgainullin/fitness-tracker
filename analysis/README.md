# Muscle Progress Replay

Read-only harness for testing the deterministic muscle points/star engine against historical workouts.

New users prime each exercise baseline across three sessions of that same primary exercise. Points count during priming, but stars remain locked until calibration completes. Existing histories prime automatically during replay.

Stars then use an unbounded 2.5% compounded strength ladder. They reflect the current three-session-smoothed strength index, so sustained decline removes stars and later recovery restores them. Peak stars remain available as historical context.

## Open the replay UI

From the repository root:

```bash
python3 -m http.server 8766
```

Then open:

```text
http://localhost:8766/analysis/replay.html
```

Select **Load local history** to replay `data/workouts.json` and `data/sets.json`, or choose another Workouts/Sets export with the file picker.

The UI supports stepping, autoplay, scrubbing, scoring-config edits, and per-workout exclusions. Local history automatically applies `replay-exclusions.json`; source workout data is never modified.

## Generate a terminal report

```bash
node analysis/replay-report.js
node analysis/replay-report.js --trace
node analysis/replay-report.js --include-outliers
```

The report applies `replay-exclusions.json` by default. Additional records can be omitted with `--exclude-id=WORKOUT_ID` or `--exclude-date=YYYY-MM-DD`.

## Run engine tests

```bash
node --test analysis/progress-engine.test.js
```

The browser harness, report, and tests all use `public/progress-engine.js`.
