const STORAGE_KEY = "ptGuideProgram";

const DEFAULT_EXERCISES = [
  {
    name: "L Holds",
    detail: "30 second hold, 30 second rest, 4 sets",
    type: "timed",
    activeLabel: "Hold",
    duration: 30,
    sets: 4,
    rest: 30,
  },
  {
    name: "Clamshell Holds (Light Band)",
    detail: "30 second hold, 30 second rest, 4 sets",
    type: "timed",
    activeLabel: "Hold",
    duration: 30,
    sets: 4,
    rest: 30,
  },
  {
    name: "Side-lying Hip Abduction",
    detail: "30 seconds, 30 second rest, 3 sets",
    type: "timed",
    activeLabel: "Stretch",
    duration: 30,
    sets: 3,
    rest: 30,
  },
];

const RING_CIRCUMFERENCE = 2 * Math.PI * 52;

const elements = {
  exercisePosition: document.getElementById("exercise-position"),
  phaseLabel: document.getElementById("phase-label"),
  stepKicker: document.getElementById("step-kicker"),
  exerciseName: document.getElementById("exercise-name"),
  exerciseDetail: document.getElementById("exercise-detail"),
  countdownCaption: document.getElementById("countdown-caption"),
  countdownValue: document.getElementById("countdown-value"),
  setProgress: document.getElementById("set-progress"),
  manualPanel: document.getElementById("manual-panel"),
  startButton: document.getElementById("start-button"),
  pauseButton: document.getElementById("pause-button"),
  resumeButton: document.getElementById("resume-button"),
  resetButton: document.getElementById("reset-button"),
  completeSetButton: document.getElementById("complete-set-button"),
  exerciseList: document.getElementById("exercise-list"),
  ringProgress: document.getElementById("ring-progress"),
  confettiLayer: document.getElementById("confetti-layer"),

  editProgramButton: document.getElementById("edit-program-button"),
  editModal: document.getElementById("edit-modal"),
  closeModalButton: document.getElementById("close-modal-button"),
  cancelEditButton: document.getElementById("cancel-edit-button"),
  modeQuickButton: document.getElementById("mode-quick-button"),
  modeFormButton: document.getElementById("mode-form-button"),
  quickMode: document.getElementById("quick-mode"),
  formMode: document.getElementById("form-mode"),
  quickTextarea: document.getElementById("quick-textarea"),
  formRows: document.getElementById("form-rows"),
  addRowButton: document.getElementById("add-row-button"),
  saveProgramButton: document.getElementById("save-program-button"),
  editError: document.getElementById("edit-error"),
};

const audioContextState = {
  ctx: null,
};

let EXERCISES = loadProgram();
let state = createInitialState();

elements.ringProgress.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;

renderExerciseList();
render();

elements.startButton.addEventListener("click", startCurrentExercise);
elements.pauseButton.addEventListener("click", pauseFlow);
elements.resumeButton.addEventListener("click", resumeFlow);
elements.resetButton.addEventListener("click", resetApp);
elements.completeSetButton.addEventListener("click", handleManualCompletion);

elements.editProgramButton.addEventListener("click", openEditModal);
elements.closeModalButton.addEventListener("click", closeEditModal);
elements.cancelEditButton.addEventListener("click", closeEditModal);
elements.modeQuickButton.addEventListener("click", () => switchEditMode("quick"));
elements.modeFormButton.addEventListener("click", () => switchEditMode("form"));
elements.addRowButton.addEventListener("click", () => addFormRow());
elements.saveProgramButton.addEventListener("click", handleSaveProgram);

function createInitialState() {
  return {
    exerciseIndex: 0,
    setIndex: 0,
    phase: "idle",
    phaseLabel: "Ready",
    started: false,
    paused: false,
    timerId: null,
    endTime: null,
    remainingSeconds: null,
    lastBeepSecond: null,
    timedCompleteAction: null,
    programComplete: false,
  };
}

/* ---------------- Program storage ---------------- */

function loadProgram() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_EXERCISES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (error) {
    console.warn("Could not load saved program, using default.", error);
  }
  return DEFAULT_EXERCISES;
}

function saveProgram(newExercises) {
  EXERCISES = newExercises;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(newExercises));
  } catch (error) {
    console.warn("Could not save program to this browser.", error);
  }
  resetApp();
}

/* ---------------- Rendering ---------------- */

function renderExerciseList() {
  elements.exerciseList.innerHTML = EXERCISES.map((exercise, index) => {
    const statusClass = index < state.exerciseIndex
      ? "complete"
      : index === state.exerciseIndex
        ? "active"
        : "";

    return `
      <article class="exercise-item ${statusClass}">
        <div class="exercise-badge">${index + 1}</div>
        <div class="exercise-copy">
          <strong>${escapeHtml(exercise.name)}</strong>
          <span>${escapeHtml(exercise.detail)}</span>
        </div>
      </article>
    `;
  }).join("");
}

function render() {
  const exercise = EXERCISES[state.exerciseIndex];
  const isManualActive = state.phase === "manual";
  const isPaused = state.paused;
  const currentSet = Math.min(state.setIndex + 1, exercise?.sets || 1);

  renderExerciseList();

  if (!exercise) {
    elements.exercisePosition.textContent = `${EXERCISES.length} of ${EXERCISES.length}`;
    elements.phaseLabel.textContent = "Complete";
    elements.stepKicker.textContent = "Session complete";
    elements.exerciseName.textContent = "Nice work";
    elements.exerciseDetail.textContent = "You finished every exercise in today’s PT program.";
    elements.countdownCaption.textContent = "Session done";
    elements.countdownValue.textContent = "Done";
    elements.setProgress.textContent = "All exercises complete";
    elements.manualPanel.classList.add("hidden");
    elements.startButton.classList.add("hidden");
    elements.pauseButton.classList.add("hidden");
    elements.resumeButton.classList.add("hidden");
    updateRing(1);
    return;
  }

  elements.exercisePosition.textContent = `${state.exerciseIndex + 1} of ${EXERCISES.length}`;
  elements.phaseLabel.textContent = state.phaseLabel;
  elements.exerciseName.textContent = exercise.name;
  elements.exerciseDetail.textContent = exercise.detail;
  elements.setProgress.textContent = `Set ${currentSet} of ${exercise.sets}`;

  if (state.phase === "idle") {
    elements.stepKicker.textContent = state.started ? "Next exercise" : "Up first";
    elements.countdownCaption.textContent = "Tap start to begin";
    elements.countdownValue.textContent = "Start";
    updateRing(0);
  }

  if (state.phase === "active") {
    elements.stepKicker.textContent = exercise.type === "timed" ? "Exercise in progress" : "Exercise";
    elements.countdownCaption.textContent = exercise.activeLabel;
  }

  if (state.phase === "rest") {
    elements.stepKicker.textContent = "Recovery";
    elements.countdownCaption.textContent = "Rest";
  }

  if (state.phase === "manual") {
    elements.stepKicker.textContent = "Manual completion";
    elements.countdownCaption.textContent = "Finish your reps";
    elements.countdownValue.textContent = `${exercise.reps}`;
    updateRing(1);
  }

  if (isPaused) {
    elements.phaseLabel.textContent = "Paused";
  }

  elements.manualPanel.querySelector("p").textContent = `${exercise.name} ${exercise.reps === 1 ? "is" : "are"} reps-based.`;
  elements.manualPanel.classList.toggle("hidden", !isManualActive);
  elements.completeSetButton.disabled = isPaused;
  elements.startButton.classList.toggle("hidden", state.phase !== "idle");
  elements.pauseButton.classList.toggle("hidden", !canPause());
  elements.resumeButton.classList.toggle("hidden", !isPaused);
}

function canPause() {
  return state.started && !state.paused && ["active", "rest", "manual"].includes(state.phase);
}

async function startCurrentExercise() {
  if (state.programComplete || state.phase !== "idle") {
    return;
  }

  await unlockAudio();
  state.started = true;
  beginExercisePhase();
}

function beginExercisePhase() {
  const exercise = EXERCISES[state.exerciseIndex];

  if (exercise.type === "manual") {
    state.phase = "manual";
    state.phaseLabel = "In progress";
    state.paused = false;
    state.endTime = null;
    state.lastBeepSecond = null;
    render();
    return;
  }

  startTimedPhase("active", exercise.duration, exercise.activeLabel, finishExercisePhase);
}

function finishExercisePhase() {
  const exercise = EXERCISES[state.exerciseIndex];
  const moreSetsRemain = state.setIndex < exercise.sets - 1;

  if (moreSetsRemain && exercise.rest > 0) {
    startTimedPhase("rest", exercise.rest, "Rest", finishRestPhase);
    return;
  }

  advanceAfterSet();
}

function finishRestPhase() {
  advanceAfterSet();
}

function advanceAfterSet() {
  const exercise = EXERCISES[state.exerciseIndex];

  if (state.setIndex < exercise.sets - 1) {
    state.setIndex += 1;
    beginExercisePhase();
    return;
  }

  moveToNextExercise();
}

function moveToNextExercise() {
  state.exerciseIndex += 1;
  state.setIndex = 0;
  state.phase = "idle";
  state.phaseLabel = "Ready";
  state.paused = false;
  state.remainingSeconds = null;
  state.endTime = null;
  state.lastBeepSecond = null;
  state.timedCompleteAction = null;
  clearTimer();

  if (state.exerciseIndex >= EXERCISES.length) {
    state.programComplete = true;
    launchConfetti();
  }

  render();
}

function handleManualCompletion() {
  if (state.phase !== "manual") {
    return;
  }

  moveToNextExercise();
}

function startTimedPhase(phase, seconds, label, onComplete) {
  clearTimer();
  state.phase = phase;
  state.phaseLabel = label;
  state.paused = false;
  state.remainingSeconds = seconds;
  state.timedCompleteAction = onComplete;
  state.lastBeepSecond = null;
  runCountdown(seconds, onComplete, true);
}

function runCountdown(seconds, onComplete, beepLastThree = false) {
  state.endTime = Date.now() + seconds * 1000;
  tickCountdown(seconds, seconds, onComplete, beepLastThree);
}

function tickCountdown(totalSeconds, displayedSeconds, onComplete, beepLastThree) {
  clearTimer();

  state.remainingSeconds = displayedSeconds;
  updateCountdownText(displayedSeconds);
  updateRing(totalSeconds === 0 ? 1 : 1 - displayedSeconds / totalSeconds);

  if (beepLastThree && displayedSeconds <= 3 && displayedSeconds > 0 && state.lastBeepSecond !== displayedSeconds) {
    state.lastBeepSecond = displayedSeconds;
    beep();
  }

  render();

  if (displayedSeconds === 0) {
    updateRing(1);
    onComplete();
    return;
  }

  state.timerId = window.setTimeout(() => {
    const millisLeft = Math.max(0, state.endTime - Date.now());
    const nextDisplayed = Math.max(0, Math.ceil(millisLeft / 1000));
    tickCountdown(totalSeconds, nextDisplayed, onComplete, beepLastThree);
  }, 200);
}

function pauseFlow() {
  if (!canPause()) {
    return;
  }

  state.paused = true;
  clearTimer();
  if (state.endTime) {
    state.remainingSeconds = Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));
  }
  render();
}

function resumeFlow() {
  if (!state.paused) {
    return;
  }

  state.paused = false;

  if (state.phase === "active") {
    const exercise = EXERCISES[state.exerciseIndex];
    startTimedPhase(
      "active",
      state.remainingSeconds ?? exercise.duration,
      exercise.activeLabel,
      state.timedCompleteAction ?? finishExercisePhase,
    );
  } else if (state.phase === "rest") {
    startTimedPhase("rest", state.remainingSeconds ?? 0, "Rest", state.timedCompleteAction ?? finishRestPhase);
  } else if (state.phase === "manual") {
    render();
  }
}

function resetApp() {
  clearTimer();
  state = createInitialState();
  elements.confettiLayer.innerHTML = "";
  render();
}

function clearTimer() {
  if (state.timerId) {
    window.clearTimeout(state.timerId);
    state.timerId = null;
  }
}

function updateCountdownText(seconds) {
  if (state.phase === "active" || state.phase === "rest") {
    elements.countdownValue.textContent = formatTime(seconds);
  }
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (mins === 0) {
    return `${secs}s`;
  }

  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function updateRing(progress) {
  const bounded = Math.max(0, Math.min(progress, 1));
  const offset = RING_CIRCUMFERENCE * (1 - bounded);
  elements.ringProgress.style.strokeDashoffset = `${offset}`;
}

function beep() {
  try {
    const ctx = getAudioContext();
    if (!ctx || ctx.state !== "running") {
      return;
    }

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    oscillator.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    oscillator.start(now);
    oscillator.stop(now + 0.1);
  } catch (error) {
    console.warn("Audio unavailable", error);
  }
}

function getAudioContext() {
  if (!audioContextState.ctx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }
    audioContextState.ctx = new AudioContextClass();
  }

  return audioContextState.ctx;
}

async function unlockAudio() {
  try {
    const ctx = getAudioContext();
    if (!ctx) {
      return;
    }

    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    if (ctx.state !== "running") {
      return;
    }

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.05);
  } catch (error) {
    console.warn("Audio unlock unavailable", error);
  }
}

function launchConfetti() {
  const colors = ["#e87c4b", "#183e39", "#2d8b68", "#f2b874", "#f6c7a6"];
  const pieces = 80;

  elements.confettiLayer.innerHTML = "";

  for (let index = 0; index < pieces; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[index % colors.length];
    piece.style.animationDelay = `${Math.random() * 350}ms`;
    piece.style.animationDuration = `${1800 + Math.random() * 1800}ms`;
    piece.style.setProperty("--drift", `${-80 + Math.random() * 160}px`);
    elements.confettiLayer.appendChild(piece);
  }

  window.setTimeout(() => {
    elements.confettiLayer.innerHTML = "";
  }, 4500);
}

/* ---------------- Edit-program modal ---------------- */

function openEditModal() {
  elements.quickTextarea.value = EXERCISES
    .map((exercise) => `${exercise.name}, ${exercise.detail}`)
    .join("\n");

  elements.formRows.innerHTML = "";
  EXERCISES.forEach((exercise) => addFormRow(exercise));

  hideEditError();
  switchEditMode("form");
  elements.editModal.classList.remove("hidden");
}

function closeEditModal() {
  elements.editModal.classList.add("hidden");
}

function switchEditMode(mode) {
  const isQuick = mode === "quick";
  elements.quickMode.classList.toggle("hidden", !isQuick);
  elements.formMode.classList.toggle("hidden", isQuick);
  elements.modeQuickButton.classList.toggle("active", isQuick);
  elements.modeFormButton.classList.toggle("active", !isQuick);
}

function showEditError(message) {
  elements.editError.textContent = message;
  elements.editError.classList.remove("hidden");
}

function hideEditError() {
  elements.editError.textContent = "";
  elements.editError.classList.add("hidden");
}

function handleSaveProgram() {
  const isQuickMode = !elements.quickMode.classList.contains("hidden");
  const { exercises, errors } = isQuickMode
    ? parseQuickText(elements.quickTextarea.value)
    : collectFormExercises();

  if (errors.length > 0) {
    showEditError(errors.join(" — "));
    return;
  }

  if (exercises.length === 0) {
    showEditError("Add at least one exercise before saving.");
    return;
  }

  const finalized = exercises.map((exercise) => ({
    ...exercise,
    detail: buildDetailText(exercise),
  }));

  saveProgram(finalized);
  closeEditModal();
}

/* ---- Quick-text mode ---- */

function parseQuickText(text) {
  const lines = text.split("\n");
  const exercises = [];
  const errors = [];

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    const parsed = parseExerciseLine(line);
    if (!parsed) {
      errors.push(`Line ${index + 1}: couldn't find a hold time or rep count`);
      return;
    }

    exercises.push(parsed);
  });

  return { exercises, errors };
}

const TIME_UNIT = "(?:seconds|second|secs|sec|s|minutes|minute|mins|min|m)";

function parseExerciseLine(line) {
  const firstComma = line.indexOf(",");
  const name = (firstComma === -1 ? line : line.slice(0, firstComma)).trim();
  const rest = firstComma === -1 ? "" : line.slice(firstComma + 1);

  if (!name) {
    return null;
  }

  const setsMatch = rest.match(/(\d+)\s*sets?/i);
  const sets = setsMatch ? Math.max(1, parseInt(setsMatch[1], 10)) : 1;

  const restRegex = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${TIME_UNIT})\\b[^,]*\\brest`, "i");
  const restMatch = rest.match(restRegex);
  const restSeconds = restMatch ? timeToSeconds(restMatch[1], restMatch[2]) : 0;

  const repsMatch = rest.match(/(\d+)\s*reps?\b/i);
  const reps = repsMatch ? parseInt(repsMatch[1], 10) : null;

  let duration = null;
  let activeLabel = "Hold";
  const timeRegex = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${TIME_UNIT})\\b([^,]*)`, "gi");
  const timeMatches = [...rest.matchAll(timeRegex)];

  for (const match of timeMatches) {
    const context = match[3] || "";
    if (/rest/i.test(context)) {
      continue;
    }
    duration = timeToSeconds(match[1], match[2]);
    break;
  }

  if (duration != null && /stretch/i.test(line)) {
    activeLabel = "Stretch";
  }

  if (duration == null && reps == null) {
    return null;
  }

  if (duration != null) {
    return {
      name,
      type: "timed",
      activeLabel,
      duration,
      sets,
      rest: restSeconds,
      detail: "",
    };
  }

  return {
    name,
    type: "manual",
    activeLabel: "Reps",
    reps,
    sets,
    rest: 0,
    detail: "",
  };
}

function timeToSeconds(numString, unit) {
  const value = parseFloat(numString);
  if (/^m/i.test(unit)) {
    return Math.round(value * 60);
  }
  return Math.round(value);
}

/* ---- Form mode ---- */

function addFormRow(exercise) {
  const row = document.createElement("div");
  row.className = "form-row";
  row.innerHTML = `
    <input type="text" class="row-name" placeholder="Exercise name" value="${exercise ? escapeHtml(exercise.name) : ""}" />
    <div class="row-line">
      <select class="row-type">
        <option value="timed">Timed hold</option>
        <option value="manual">Reps</option>
      </select>
      <input type="number" class="row-duration" placeholder="Hold sec" min="1" value="${exercise && exercise.type === "timed" ? exercise.duration : ""}" />
      <input type="number" class="row-reps hidden" placeholder="Reps" min="1" value="${exercise && exercise.type === "manual" ? exercise.reps : ""}" />
    </div>
    <div class="row-line">
      <input type="number" class="row-sets" placeholder="Sets" min="1" value="${exercise ? exercise.sets : 1}" />
      <input type="number" class="row-rest" placeholder="Rest sec" min="0" value="${exercise && exercise.rest ? exercise.rest : 0}" />
      <button type="button" class="row-remove">Remove</button>
    </div>
  `;

  const typeSelect = row.querySelector(".row-type");
  const durationInput = row.querySelector(".row-duration");
  const repsInput = row.querySelector(".row-reps");

  if (exercise) {
    typeSelect.value = exercise.type;
  }

  const syncTypeVisibility = () => {
    const isManual = typeSelect.value === "manual";
    durationInput.classList.toggle("hidden", isManual);
    repsInput.classList.toggle("hidden", !isManual);
  };

  syncTypeVisibility();
  typeSelect.addEventListener("change", syncTypeVisibility);

  row.querySelector(".row-remove").addEventListener("click", () => {
    row.remove();
  });

  elements.formRows.appendChild(row);
}

function collectFormExercises() {
  const rows = Array.from(elements.formRows.querySelectorAll(".form-row"));
  const exercises = [];
  const errors = [];

  rows.forEach((row, index) => {
    const name = row.querySelector(".row-name").value.trim();
    const type = row.querySelector(".row-type").value;
    const durationVal = row.querySelector(".row-duration").value;
    const repsVal = row.querySelector(".row-reps").value;
    const setsVal = row.querySelector(".row-sets").value;
    const restVal = row.querySelector(".row-rest").value;

    if (!name) {
      errors.push(`Row ${index + 1}: name is required`);
      return;
    }

    const sets = Math.max(1, parseInt(setsVal, 10) || 1);

    if (type === "manual") {
      const reps = parseInt(repsVal, 10);
      if (!reps || reps <= 0) {
        errors.push(`${name}: enter a rep count`);
        return;
      }
      exercises.push({
        name,
        type: "manual",
        activeLabel: "Reps",
        reps,
        sets,
        rest: 0,
        detail: "",
      });
      return;
    }

    const duration = parseInt(durationVal, 10);
    if (!duration || duration <= 0) {
      errors.push(`${name}: enter a hold time`);
      return;
    }
    const rest = Math.max(0, parseInt(restVal, 10) || 0);
    exercises.push({
      name,
      type: "timed",
      activeLabel: "Hold",
      duration,
      sets,
      rest,
      detail: "",
    });
  });

  return { exercises, errors };
}

/* ---- Shared helpers ---- */

function buildDetailText(exercise) {
  if (exercise.type === "manual") {
    return `${exercise.reps} reps, ${pluralize(exercise.sets, "set")}`;
  }

  const durationText = formatDurationLabel(exercise.duration);
  const label = (exercise.activeLabel || "Hold").toLowerCase();
  const restText = exercise.rest > 0 ? `, ${formatDurationLabel(exercise.rest)} rest` : "";

  return `${durationText} ${label}${restText}, ${pluralize(exercise.sets, "set")}`;
}

function formatDurationLabel(totalSeconds) {
  if (totalSeconds >= 60 && totalSeconds % 60 === 0) {
    const mins = totalSeconds / 60;
    return `${mins} ${pluralize(mins, "minute", true)}`;
  }
  return `${totalSeconds} ${pluralize(totalSeconds, "second", true)}`;
}

function pluralize(count, noun, wordOnly = false) {
  const word = count === 1 ? noun : `${noun}s`;
  return wordOnly ? word : `${count} ${word}`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}
