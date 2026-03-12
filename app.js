const EXERCISES = [
  {
    name: "Wall Sits",
    detail: "45 second hold, 1 minute rest, 5 sets",
    type: "timed",
    activeLabel: "Hold",
    duration: 45,
    sets: 5,
    rest: 60,
  },
  {
    name: "Heel Slides",
    detail: "15 reps, 1 set",
    type: "manual",
    activeLabel: "Reps",
    reps: 15,
    sets: 1,
    rest: 0,
  },
  {
    name: "Hamstring Stretch",
    detail: "30 seconds, 30 second rest, 3 sets",
    type: "timed",
    activeLabel: "Stretch",
    duration: 30,
    sets: 3,
    rest: 30,
  },
];

const PREP_COUNTDOWN = 3;
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
};

const audioContextState = {
  ctx: null,
};

let state = createInitialState();

elements.ringProgress.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;

renderExerciseList();
render();

elements.startButton.addEventListener("click", startCurrentExercise);
elements.pauseButton.addEventListener("click", pauseFlow);
elements.resumeButton.addEventListener("click", resumeFlow);
elements.resetButton.addEventListener("click", resetApp);
elements.completeSetButton.addEventListener("click", handleManualCompletion);

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
    prepareCompleteAction: null,
    timedCompleteAction: null,
    programComplete: false,
  };
}

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
          <strong>${exercise.name}</strong>
          <span>${exercise.detail}</span>
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

  if (state.phase === "prepare") {
    elements.stepKicker.textContent = "Get ready";
    elements.countdownCaption.textContent = "Starting in";
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

  elements.manualPanel.classList.toggle("hidden", !isManualActive);
  elements.completeSetButton.disabled = isPaused;
  elements.startButton.classList.toggle("hidden", state.phase !== "idle");
  elements.pauseButton.classList.toggle("hidden", !canPause());
  elements.resumeButton.classList.toggle("hidden", !isPaused);
}

function canPause() {
  return state.started && !state.paused && ["prepare", "active", "rest", "manual"].includes(state.phase);
}

function startCurrentExercise() {
  if (state.programComplete || state.phase !== "idle") {
    return;
  }

  state.started = true;
  startPrepareCountdown(beginExercisePhase);
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
    startPrepareCountdown(() => {
      startTimedPhase("rest", exercise.rest, "Rest", finishRestPhase);
    });
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
    startPrepareCountdown(beginExercisePhase);
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
  state.prepareCompleteAction = null;
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

function startPrepareCountdown(onComplete) {
  clearTimer();
  state.phase = "prepare";
  state.phaseLabel = "Countdown";
  state.paused = false;
  state.prepareCompleteAction = onComplete;
  state.timedCompleteAction = null;
  state.lastBeepSecond = null;
  runCountdown(PREP_COUNTDOWN, onComplete);
}

function startTimedPhase(phase, seconds, label, onComplete) {
  clearTimer();
  state.phase = phase;
  state.phaseLabel = label;
  state.paused = false;
  state.remainingSeconds = seconds;
  state.prepareCompleteAction = null;
  state.timedCompleteAction = onComplete;
  state.lastBeepSecond = null;
  runCountdown(seconds, onComplete);
}

function runCountdown(seconds, onComplete) {
  state.endTime = Date.now() + seconds * 1000;
  tickCountdown(seconds, seconds, onComplete);
}

function tickCountdown(totalSeconds, displayedSeconds, onComplete) {
  clearTimer();

  state.remainingSeconds = displayedSeconds;
  updateCountdownText(displayedSeconds);
  updateRing(totalSeconds === 0 ? 1 : 1 - displayedSeconds / totalSeconds);

  if (displayedSeconds <= 3 && displayedSeconds > 0 && state.lastBeepSecond !== displayedSeconds) {
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
    tickCountdown(totalSeconds, nextDisplayed, onComplete);
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

  if (state.phase === "prepare") {
    runCountdown(
      state.remainingSeconds ?? PREP_COUNTDOWN,
      state.prepareCompleteAction ?? beginExercisePhase,
    );
  } else if (state.phase === "active") {
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
  if (state.phase === "prepare") {
    elements.countdownValue.textContent = `${seconds}`;
    return;
  }

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
    if (!audioContextState.ctx) {
      audioContextState.ctx = new window.AudioContext();
    }

    if (audioContextState.ctx.state === "suspended") {
      audioContextState.ctx.resume();
    }

    const oscillator = audioContextState.ctx.createOscillator();
    const gain = audioContextState.ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.02;
    oscillator.connect(gain);
    gain.connect(audioContextState.ctx.destination);

    const now = audioContextState.ctx.currentTime;
    oscillator.start(now);
    oscillator.stop(now + 0.12);
  } catch (error) {
    console.warn("Audio unavailable", error);
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
