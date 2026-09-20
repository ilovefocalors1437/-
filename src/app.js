import { BlinkEngine, deriveCalibration } from "./blink-engine.js";
import {
  BlinkBurstBuffer,
  CHARACTER_BANKS,
  COMMAND_TOKENS,
  RouletteScanner,
  applyToken,
  getItemLabel,
  removeLastGrapheme,
} from "./interaction.js";

const MEDIAPIPE_VERSION = "1.0.1";
const MEDIAPIPE_MODULE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/+esm`;
const MEDIAPIPE_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const STORAGE_KEY = "blink-to-speak-settings-v1";

const DEFAULT_SETTINGS = Object.freeze({
  scanSpeed: 1_350,
  blinkCount: 2,
  burstWindow: 1_300,
  longClose: 10,
  openThreshold: 0.34,
  closedThreshold: 0.58,
});

const $ = (selector) => document.querySelector(selector);

const elements = {
  video: $("#cameraVideo"),
  canvas: $("#cameraOverlay"),
  cameraPlaceholder: $("#cameraPlaceholder"),
  cameraButton: $("#cameraButton"),
  calibrateButton: $("#calibrateButton"),
  trackingBadge: $("#trackingBadge"),
  signalIcon: $("#signalIcon"),
  signalTitle: $("#signalTitle"),
  signalDetail: $("#signalDetail"),
  eyeScoreText: $("#eyeScoreText"),
  eyeMeterFill: $("#eyeMeterFill"),
  eyeThresholdMark: $("#eyeThresholdMark"),
  longCloseOverlay: $("#longCloseOverlay"),
  longCloseCountdown: $("#longCloseCountdown"),
  messageOutput: $("#messageOutput"),
  characterCount: $("#characterCount"),
  speakButton: $("#speakButton"),
  undoButton: $("#undoButton"),
  clearButton: $("#clearButton"),
  scanToggle: $("#scanToggle"),
  scanToggleText: $("#scanToggleText"),
  currentChoice: $("#currentChoice"),
  choiceHint: $("#choiceHint"),
  bankTabs: $("#bankTabs"),
  characterGrid: $("#characterGrid"),
  burstProgress: $("#burstProgress"),
  switchBlinkLabel: $("#switchBlinkLabel"),
  longCloseLabel: $("#longCloseLabel"),
  settingsButton: $("#settingsButton"),
  settingsPanel: $("#settingsPanel"),
  closeSettings: $("#closeSettings"),
  settingsBackdrop: $("#settingsBackdrop"),
  scanSpeed: $("#scanSpeed"),
  scanSpeedOutput: $("#scanSpeedOutput"),
  blinkCount: $("#blinkCount"),
  blinkCountOutput: $("#blinkCountOutput"),
  burstWindow: $("#burstWindow"),
  burstWindowOutput: $("#burstWindowOutput"),
  longClose: $("#longClose"),
  longCloseOutput: $("#longCloseOutput"),
  thresholdValue: $("#thresholdValue"),
  resetSettings: $("#resetSettings"),
  calibrationModal: $("#calibrationModal"),
  calibrationVisual: $("#calibrationVisual"),
  calibrationTitle: $("#calibrationTitle"),
  calibrationInstruction: $("#calibrationInstruction"),
  calibrationCountdown: $("#calibrationCountdown"),
  calibrationProgress: $("#calibrationProgress"),
  cancelCalibration: $("#cancelCalibration"),
  toastRegion: $("#toastRegion"),
};

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

let settings = loadSettings();
const scanner = new RouletteScanner({ intervalMs: settings.scanSpeed });
const burstBuffer = new BlinkBurstBuffer({
  switchBlinkCount: settings.blinkCount,
  burstWindowMs: settings.burstWindow,
});
const blinkEngine = new BlinkEngine({
  openThreshold: settings.openThreshold,
  closedThreshold: settings.closedThreshold,
  longCloseMs: settings.longClose * 1_000,
});

let faceLandmarker = null;
let mediaStream = null;
let animationFrame = null;
let lastVideoTime = -1;
let message = "";
let scanRequested = false;
let faceIsPresent = false;
let closureCandidate = null;
let resumeScanAt = 0;
let calibration = null;
let lastRawEyeScore = 0;
let clearConfirmationDeadline = 0;

function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function setTrackingStatus(kind, label) {
  elements.trackingBadge.className = `status-badge is-${kind}`;
  elements.trackingBadge.lastChild.textContent = label;
}

function setSignal(title, detail, icon = "○") {
  elements.signalTitle.textContent = title;
  elements.signalDetail.textContent = detail;
  elements.signalIcon.textContent = icon;
}

function toast(text, type = "info") {
  const item = document.createElement("div");
  item.className = `toast${type === "error" ? " is-error" : ""}`;
  item.textContent = text;
  elements.toastRegion.append(item);
  window.setTimeout(() => item.remove(), 3_400);
}

function renderMessage() {
  if (message) {
    elements.messageOutput.textContent = message;
  } else {
    elements.messageOutput.innerHTML = '<span class="empty-message">ข้อความที่เลือกจะแสดงตรงนี้…</span>';
  }
  const count = Array.from(message).length;
  elements.characterCount.textContent = `${count} ตัวอักษร`;
  elements.speakButton.disabled = !message.trim();
  elements.undoButton.disabled = !message;
  elements.clearButton.disabled = !message;
}

function renderBanks() {
  elements.bankTabs.replaceChildren();
  scanner.banks.forEach((bank) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bank-tab";
    button.role = "tab";
    button.dataset.bankId = bank.id;
    button.setAttribute("aria-selected", String(bank.id === scanner.bank.id));
    button.textContent = bank.label;
    button.addEventListener("click", () => {
      burstBuffer.cancel();
      clearConfirmationDeadline = 0;
      scanner.setBank(bank.id, performance.now());
      renderBanks();
      renderCharacterGrid();
      renderCurrentChoice();
    });
    elements.bankTabs.append(button);
  });
}

function renderCharacterGrid() {
  elements.characterGrid.replaceChildren();
  elements.characterGrid.classList.toggle(
    "is-phrases",
    scanner.bank.id === "quick" || scanner.bank.id === "commands",
  );
  scanner.bank.items.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `character-key${index === scanner.itemIndex ? " is-active" : ""}`;
    const label = getItemLabel(item);
    button.textContent = label;
    button.setAttribute("aria-label", `เลือก ${label}`);
    button.addEventListener("click", () => {
      burstBuffer.cancel();
      elements.burstProgress.hidden = true;
      scanner.selectIndex(index, performance.now());
      applySelection(item);
      renderCharacterGrid();
      renderCurrentChoice();
    });
    elements.characterGrid.append(button);
  });
}

function renderCurrentChoice() {
  if (clearConfirmationDeadline > performance.now()) {
    const seconds = Math.ceil((clearConfirmationDeadline - performance.now()) / 1_000);
    elements.currentChoice.textContent = "ยืนยันล้าง?";
    elements.currentChoice.classList.add("is-phrase");
    elements.choiceHint.textContent = `กระพริบ 1 ครั้งอีกครั้ง • รอ ${seconds} วิ เพื่อยกเลิก`;
    return;
  }

  const display = getItemLabel(scanner.item);
  elements.currentChoice.textContent = display;
  elements.currentChoice.classList.toggle("is-phrase", display.length > 2);
  elements.choiceHint.textContent = !mediaStream
    ? "รอเปิดกล้อง"
    : !faceIsPresent
      ? "กำลังค้นหาใบหน้า"
      : scanRequested
        ? "กระพริบตาเพื่อเลือก"
        : "วงล้อหยุดอยู่";
}

function updateActiveKey() {
  const keys = elements.characterGrid.querySelectorAll(".character-key");
  keys.forEach((key, index) => key.classList.toggle("is-active", index === scanner.itemIndex));
  const active = keys[scanner.itemIndex];
  active?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function applySelection(token) {
  const now = performance.now();
  const label = getItemLabel(token);

  if (token === COMMAND_TOKENS.SPEAK) {
    speakMessage();
    setSignal("อ่านออกเสียงแล้ว", "เลือกคำสั่งอื่นหรือสลับกลับไปยังตัวอักษรได้", "🔊");
    return;
  }

  if (token === COMMAND_TOKENS.FINISH) {
    finalizePhrase();
    return;
  }

  if (token === COMMAND_TOKENS.CLEAR) {
    if (clearConfirmationDeadline > now) {
      message = "";
      clearConfirmationDeadline = 0;
      renderMessage();
      setSignal("ล้างข้อความแล้ว", "วงล้อจะทำงานต่อในอีกสักครู่", "✓");
      toast("ล้างข้อความแล้ว");
    } else {
      clearConfirmationDeadline = now + 8_000;
      const armedDeadline = clearConfirmationDeadline;
      scanner.pause();
      setSignal("ยืนยันการล้างข้อความ", "กระพริบ 1 ครั้งอีกครั้ง หรือรอ 8 วินาทีเพื่อยกเลิก", "?");
      toast("กระพริบอีกครั้งเพื่อยืนยันล้างข้อความ");
      window.setTimeout(() => {
        if (clearConfirmationDeadline !== armedDeadline) return;
        clearConfirmationDeadline = 0;
        resumeScanAt = performance.now() + 350;
        setSignal("ยกเลิกการล้างข้อความ", "ไม่มีข้อความถูกลบ", "↩");
        renderCurrentChoice();
      }, 8_050);
    }
    renderCurrentChoice();
    return;
  }

  message = applyToken(message, token);
  renderMessage();
  setSignal(`เลือก “${label}” แล้ว`, "วงล้อจะทำงานต่อเมื่อพร้อม", "✓");
}

function speakMessage() {
  if (!message.trim() || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message.trim());
  utterance.lang = "th-TH";
  utterance.rate = 0.85;
  const thaiVoice = speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("th"));
  if (thaiVoice) utterance.voice = thaiVoice;
  speechSynthesis.speak(utterance);
}

function finalizePhrase() {
  burstBuffer.cancel();
  clearConfirmationDeadline = 0;
  elements.burstProgress.hidden = true;
  if (!message.trim()) {
    toast("ยังไม่มีข้อความให้จบประโยค");
    return;
  }
  setSignal("จบประโยคแล้ว", "ข้อความพร้อมสื่อสารและอ่านออกเสียง", "✓");
  toast("จบประโยคแล้ว");
  speakMessage();
}

function updateScanButton() {
  elements.scanToggle.setAttribute("aria-pressed", String(scanRequested));
  elements.scanToggleText.textContent = scanRequested ? "หยุดวงล้อ" : "เริ่มวงล้อ";
  elements.scanToggle.querySelector(".play-icon").textContent = scanRequested ? "Ⅱ" : "▶";
}

function resumeScannerWhenReady(timestamp) {
  if (clearConfirmationDeadline > timestamp) return;
  if (scanRequested && faceIsPresent && !calibration && timestamp >= resumeScanAt && burstBuffer.count === 0) {
    if (scanner.paused) scanner.start(timestamp);
  }
}

function processBlinkEvents(events, timestamp) {
  for (const event of events) {
    if (calibration && !["tracking-found", "tracking-lost"].includes(event.type)) continue;
    switch (event.type) {
      case "tracking-found":
        faceIsPresent = true;
        setTrackingStatus("ready", "พบใบหน้า");
        setSignal("ตรวจจับดวงตาแล้ว", "กระพริบตามธรรมชาติเพื่อเลือกตัวอักษร", "✓");
        resumeScanAt = timestamp + 350;
        renderCurrentChoice();
        break;
      case "tracking-lost":
        faceIsPresent = false;
        clearConfirmationDeadline = 0;
        scanner.pause();
        burstBuffer.cancel();
        elements.burstProgress.hidden = true;
        setTrackingStatus("searching", "หาใบหน้า");
        setSignal("ไม่พบใบหน้า", "จัดใบหน้าให้อยู่กลางภาพก่อน ระบบจะหยุดรับคำสั่งชั่วคราว", "!");
        renderCurrentChoice();
        break;
      case "eyes-closed":
        closureCandidate = scanner.item;
        scanner.pause();
        break;
      case "blink": {
        const action = burstBuffer.addBlink(timestamp, closureCandidate ?? scanner.item);
        closureCandidate = null;
        if (action.type === "pending") {
          elements.burstProgress.hidden = false;
          elements.choiceHint.textContent = `ตรวจพบ ${action.count} ครั้ง — กระพริบต่อเพื่อสลับหมวด`;
        } else if (action.type === "switch-bank") {
          clearConfirmationDeadline = 0;
          elements.burstProgress.hidden = true;
          scanner.nextBank(timestamp);
          renderBanks();
          renderCharacterGrid();
          renderCurrentChoice();
          setSignal(`เปลี่ยนเป็นหมวด “${scanner.bank.label}”`, "วงล้อจะเริ่มต่อในอีกสักครู่", "↻");
          resumeScanAt = timestamp + 650;
        }
        break;
      }
      case "long-close":
        closureCandidate = null;
        scanner.pause();
        finalizePhrase();
        break;
      case "long-close-ended":
      case "closure-rejected":
        closureCandidate = null;
        resumeScanAt = timestamp + 500;
        break;
      default:
        break;
    }
  }
}

function processBurstTimeout(timestamp) {
  const action = burstBuffer.flush(timestamp);
  if (!action) return;
  elements.burstProgress.hidden = true;
  if (action.type === "select") applySelection(action.candidate);
  resumeScanAt = timestamp + 550;
  renderCurrentChoice();
}

function updateClearConfirmation(timestamp) {
  if (!clearConfirmationDeadline) return;
  if (timestamp >= clearConfirmationDeadline) {
    clearConfirmationDeadline = 0;
    resumeScanAt = timestamp + 350;
    setSignal("ยกเลิกการล้างข้อความ", "ไม่มีข้อความถูกลบ", "↩");
    renderCurrentChoice();
    return;
  }
  renderCurrentChoice();
}

function drawEyeContours(landmarks) {
  const ctx = elements.canvas.getContext("2d");
  ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
  if (!landmarks) return;

  const eyes = [
    [33, 160, 158, 133, 153, 144],
    [362, 385, 387, 263, 373, 380],
  ];
  ctx.strokeStyle = "#8fe0c8";
  ctx.lineWidth = Math.max(2, elements.canvas.width / 320);
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.shadowBlur = 4;
  for (const eye of eyes) {
    ctx.beginPath();
    eye.forEach((index, pointIndex) => {
      const point = landmarks[index];
      const x = point.x * elements.canvas.width;
      const y = point.y * elements.canvas.height;
      if (pointIndex === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
  }
}

function getBlendshapeScores(result) {
  const categories = result.faceBlendshapes?.[0]?.categories;
  if (!categories) return null;
  const scores = Object.fromEntries(categories.map((item) => [item.categoryName, item.score]));
  return {
    left: scores.eyeBlinkLeft ?? 0,
    right: scores.eyeBlinkRight ?? 0,
  };
}

function updateTelemetry(timestamp) {
  const telemetry = blinkEngine.getTelemetry(timestamp);
  const bothEyesScore = Math.min(telemetry.left, telemetry.right);
  const percent = Math.round(bothEyesScore * 100);
  elements.eyeMeterFill.style.width = `${percent}%`;
  elements.eyeScoreText.textContent = `${percent}%`;

  const showLongClose = telemetry.state === "closed" && telemetry.closedForMs > 1_000;
  elements.longCloseOverlay.hidden = !showLongClose;
  if (showLongClose) {
    const remaining = Math.max(0, settings.longClose - telemetry.closedForMs / 1_000);
    elements.longCloseCountdown.textContent = remaining.toFixed(1);
  }
}

function resizeCanvasToVideo() {
  if (!elements.video.videoWidth) return;
  if (elements.canvas.width !== elements.video.videoWidth) elements.canvas.width = elements.video.videoWidth;
  if (elements.canvas.height !== elements.video.videoHeight) elements.canvas.height = elements.video.videoHeight;
}

async function createFaceLandmarker() {
  const { FaceLandmarker, FilesetResolver } = await import(MEDIAPIPE_MODULE);
  const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
  const baseOptions = { modelAssetPath: FACE_MODEL, delegate: "GPU" };
  const options = {
    baseOptions,
    runningMode: "VIDEO",
    numFaces: 1,
    minFaceDetectionConfidence: 0.55,
    minFacePresenceConfidence: 0.55,
    minTrackingConfidence: 0.55,
    outputFaceBlendshapes: true,
  };
  try {
    return await FaceLandmarker.createFromOptions(vision, options);
  } catch (gpuError) {
    console.warn("GPU delegate unavailable; falling back to CPU.", gpuError);
    return FaceLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: { modelAssetPath: FACE_MODEL },
    });
  }
}

async function predictionLoop(timestamp) {
  if (!mediaStream) return;
  resizeCanvasToVideo();

  if (faceLandmarker && elements.video.readyState >= 2 && elements.video.currentTime !== lastVideoTime) {
    lastVideoTime = elements.video.currentTime;
    try {
      const result = faceLandmarker.detectForVideo(elements.video, timestamp);
      const landmarks = result.faceLandmarks?.[0];
      const scores = getBlendshapeScores(result);
      const facePresent = Boolean(landmarks && scores);
      drawEyeContours(landmarks);

      if (scores) lastRawEyeScore = Math.min(scores.left, scores.right);
      const events = blinkEngine.process({
        timestamp,
        leftScore: scores?.left ?? 0,
        rightScore: scores?.right ?? 0,
        facePresent,
      });
      processBlinkEvents(events, timestamp);
      collectCalibrationFrame(timestamp, facePresent ? lastRawEyeScore : null);
    } catch (error) {
      console.error(error);
    }
  }

  processBurstTimeout(timestamp);
  updateClearConfirmation(timestamp);
  resumeScannerWhenReady(timestamp);
  if (scanner.tick(timestamp)) {
    renderCurrentChoice();
    updateActiveKey();
  }
  updateTelemetry(timestamp);
  animationFrame = requestAnimationFrame(predictionLoop);
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    toast("เบราว์เซอร์นี้ไม่รองรับการเปิดกล้อง", "error");
    return;
  }
  if (!window.isSecureContext && location.hostname !== "localhost") {
    toast("การเปิดกล้องต้องใช้งานผ่าน HTTPS หรือ localhost", "error");
    return;
  }

  elements.cameraButton.disabled = true;
  setTrackingStatus("searching", "กำลังโหลด");
  setSignal("กำลังเปิดกล้อง", "อนุญาตการใช้กล้องเมื่อเบราว์เซอร์ถาม", "…");
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } },
      audio: false,
    });
    elements.video.srcObject = mediaStream;
    await elements.video.play();
    elements.cameraPlaceholder.hidden = true;
    setSignal("กำลังโหลดโมเดลดวงตา", "ครั้งแรกอาจใช้เวลาสักครู่", "…");
    faceLandmarker ??= await createFaceLandmarker();

    elements.cameraButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 10 21 7v10l-6-3v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3Z"/></svg> ปิดกล้อง';
    elements.calibrateButton.disabled = false;
    elements.scanToggle.disabled = false;
    scanRequested = true;
    updateScanButton();
    setTrackingStatus("searching", "หาใบหน้า");
    setSignal("กล้องพร้อมแล้ว", "จัดใบหน้าให้อยู่กลางภาพ", "○");
    blinkEngine.reset();
    animationFrame = requestAnimationFrame(predictionLoop);
  } catch (error) {
    console.error(error);
    stopCamera();
    const denied = error?.name === "NotAllowedError";
    setTrackingStatus("error", denied ? "ไม่ได้รับอนุญาต" : "เปิดกล้องไม่สำเร็จ");
    setSignal(
      denied ? "ไม่ได้รับสิทธิ์ใช้กล้อง" : "เกิดปัญหากับกล้อง",
      denied ? "อนุญาตกล้องจากการตั้งค่าเว็บไซต์แล้วลองใหม่" : "ตรวจสอบว่ากล้องไม่ได้ถูกโปรแกรมอื่นใช้งาน",
      "!",
    );
    toast(denied ? "กรุณาอนุญาตการใช้กล้อง" : "เปิดกล้องไม่สำเร็จ", "error");
  } finally {
    elements.cameraButton.disabled = false;
  }
}

function stopCamera() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = null;
  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
  elements.video.srcObject = null;
  elements.cameraPlaceholder.hidden = false;
  elements.cameraButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 10 21 7v10l-6-3v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3Z"/></svg> เปิดกล้อง';
  elements.calibrateButton.disabled = true;
  elements.scanToggle.disabled = true;
  scanRequested = false;
  faceIsPresent = false;
  scanner.pause();
  burstBuffer.cancel();
  blinkEngine.reset();
  drawEyeContours(null);
  setTrackingStatus("idle", "ยังไม่เริ่ม");
  setSignal("พร้อมเริ่มต้น", "จัดใบหน้าให้อยู่กลางภาพและมีแสงสว่างเพียงพอ", "○");
  updateScanButton();
  renderCurrentChoice();
}

const CALIBRATION_PHASES = [
  { id: "prepare-open", duration: 1_800, title: "เตรียมลืมตาตามปกติ", instruction: "มองตรงไปที่กล้อง ไม่ต้องเบิกตากว้าง", eye: "open" },
  { id: "collect-open", duration: 2_500, title: "ลืมตาตามปกติ", instruction: "กำลังเก็บค่าขณะลืมตา", eye: "open", collect: "open" },
  { id: "prepare-closed", duration: 1_800, title: "เตรียมหลับตา", instruction: "เมื่อเลขเริ่มนับ ให้หลับตาแบบสบาย ๆ", eye: "closed" },
  { id: "collect-closed", duration: 2_500, title: "หลับตาค้างไว้", instruction: "กำลังเก็บค่าขณะหลับตา", eye: "closed", collect: "closed" },
];

function startCalibration() {
  if (!mediaStream || !faceIsPresent) {
    toast("ต้องตรวจพบใบหน้าก่อนเริ่มปรับเทียบ", "error");
    return;
  }
  scanner.pause();
  burstBuffer.cancel();
  blinkEngine.reset();
  calibration = {
    phaseIndex: 0,
    phaseStartedAt: performance.now(),
    openSamples: [],
    closedSamples: [],
  };
  elements.calibrationModal.hidden = false;
  updateCalibrationUI(performance.now());
}

function collectCalibrationFrame(timestamp, score) {
  if (!calibration) return;
  const phase = CALIBRATION_PHASES[calibration.phaseIndex];
  if (phase.collect && Number.isFinite(score)) {
    calibration[`${phase.collect}Samples`].push(score);
  }
  updateCalibrationUI(timestamp);

  if (timestamp - calibration.phaseStartedAt >= phase.duration) {
    calibration.phaseIndex += 1;
    calibration.phaseStartedAt = timestamp;
    if (calibration.phaseIndex >= CALIBRATION_PHASES.length) finishCalibration();
  }
}

function updateCalibrationUI(timestamp) {
  if (!calibration) return;
  const phase = CALIBRATION_PHASES[calibration.phaseIndex];
  const elapsed = Math.max(0, timestamp - calibration.phaseStartedAt);
  const remaining = Math.max(0, phase.duration - elapsed);
  elements.calibrationTitle.textContent = phase.title;
  elements.calibrationInstruction.textContent = phase.instruction;
  elements.calibrationCountdown.textContent = Math.max(1, Math.ceil(remaining / 1_000));
  elements.calibrationProgress.style.width = `${Math.min(100, (elapsed / phase.duration) * 100)}%`;
  elements.calibrationVisual.classList.toggle("is-closed", phase.eye === "closed");
}

function finishCalibration() {
  const result = deriveCalibration(calibration.openSamples, calibration.closedSamples);
  calibration = null;
  elements.calibrationModal.hidden = true;

  if (!result.ok) {
    toast("ปรับเทียบไม่สำเร็จ ลองเพิ่มแสงและมองตรงกล้อง", "error");
    blinkEngine.reset();
    resumeScanAt = performance.now() + 700;
    return;
  }

  settings.openThreshold = Number(result.openThreshold.toFixed(3));
  settings.closedThreshold = Number(result.closedThreshold.toFixed(3));
  blinkEngine.configure({
    openThreshold: settings.openThreshold,
    closedThreshold: settings.closedThreshold,
  });
  blinkEngine.reset();
  saveSettings();
  renderSettings();
  setSignal("ปรับเทียบสำเร็จ", `ช่วงสัญญาณต่างกัน ${Math.round(result.separation * 100)}%`, "✓");
  toast("บันทึกค่าดวงตาสำหรับอุปกรณ์นี้แล้ว");
  resumeScanAt = performance.now() + 700;
}

function cancelCalibration() {
  calibration = null;
  elements.calibrationModal.hidden = true;
  blinkEngine.reset();
  resumeScanAt = performance.now() + 500;
}

function renderSettings() {
  elements.scanSpeed.value = settings.scanSpeed;
  elements.scanSpeedOutput.textContent = `${(settings.scanSpeed / 1_000).toFixed(2)} วิ`;
  elements.blinkCount.value = settings.blinkCount;
  elements.blinkCountOutput.textContent = `${settings.blinkCount} ครั้ง`;
  elements.burstWindow.value = settings.burstWindow;
  elements.burstWindowOutput.textContent = `${(settings.burstWindow / 1_000).toFixed(1)} วิ`;
  elements.longClose.value = settings.longClose;
  elements.longCloseOutput.textContent = `${settings.longClose} วิ`;
  elements.thresholdValue.textContent = `${Math.round(settings.closedThreshold * 100)}%`;
  elements.eyeThresholdMark.style.left = `${settings.closedThreshold * 100}%`;
  elements.switchBlinkLabel.textContent = settings.blinkCount;
  elements.longCloseLabel.textContent = settings.longClose;
}

function applySettingsFromControls() {
  settings.scanSpeed = Number(elements.scanSpeed.value);
  settings.blinkCount = Number(elements.blinkCount.value);
  settings.burstWindow = Number(elements.burstWindow.value);
  settings.longClose = Number(elements.longClose.value);
  scanner.setInterval(settings.scanSpeed);
  burstBuffer.configure({ switchBlinkCount: settings.blinkCount, burstWindowMs: settings.burstWindow });
  blinkEngine.configure({ longCloseMs: settings.longClose * 1_000 });
  saveSettings();
  renderSettings();
}

function setSettingsOpen(open) {
  elements.settingsPanel.classList.toggle("is-open", open);
  elements.settingsPanel.setAttribute("aria-hidden", String(!open));
  elements.settingsBackdrop.hidden = !open;
  elements.settingsButton.setAttribute("aria-expanded", String(open));
  if (open) elements.closeSettings.focus();
}

elements.cameraButton.addEventListener("click", () => (mediaStream ? stopCamera() : startCamera()));
elements.calibrateButton.addEventListener("click", startCalibration);
elements.cancelCalibration.addEventListener("click", cancelCalibration);
elements.scanToggle.addEventListener("click", () => {
  scanRequested = !scanRequested;
  if (scanRequested && faceIsPresent) scanner.start(performance.now());
  else scanner.pause();
  updateScanButton();
  renderCurrentChoice();
});
elements.speakButton.addEventListener("click", speakMessage);
elements.undoButton.addEventListener("click", () => {
  clearConfirmationDeadline = 0;
  message = removeLastGrapheme(message);
  renderMessage();
});
elements.clearButton.addEventListener("click", () => {
  clearConfirmationDeadline = 0;
  message = "";
  renderMessage();
  toast("ล้างข้อความแล้ว");
});
elements.settingsButton.addEventListener("click", () => setSettingsOpen(true));
elements.closeSettings.addEventListener("click", () => setSettingsOpen(false));
elements.settingsBackdrop.addEventListener("click", () => setSettingsOpen(false));
for (const input of [elements.scanSpeed, elements.blinkCount, elements.burstWindow, elements.longClose]) {
  input.addEventListener("input", applySettingsFromControls);
}
elements.resetSettings.addEventListener("click", () => {
  settings = { ...DEFAULT_SETTINGS };
  scanner.setInterval(settings.scanSpeed);
  burstBuffer.configure({ switchBlinkCount: settings.blinkCount, burstWindowMs: settings.burstWindow });
  blinkEngine.configure({
    openThreshold: settings.openThreshold,
    closedThreshold: settings.closedThreshold,
    longCloseMs: settings.longClose * 1_000,
  });
  blinkEngine.reset();
  saveSettings();
  renderSettings();
  toast("คืนค่าเริ่มต้นแล้ว");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (calibration) cancelCalibration();
    setSettingsOpen(false);
  }
  // Space is a caregiver/testing fallback when focus is not on a control.
  if (event.code === "Space" && event.target === document.body) {
    event.preventDefault();
    applySelection(scanner.item);
  }
});
window.addEventListener("beforeunload", stopCamera);

renderMessage();
renderBanks();
renderCharacterGrid();
renderCurrentChoice();
renderSettings();
updateScanButton();
