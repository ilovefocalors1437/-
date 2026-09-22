import { BlinkEngine, deriveCalibration } from "./blink-engine.js";
import {
  CHARACTER_BANKS,
  RemoteScanner,
  BlinkCommandResolver,
  applyToken,
  removeLastGrapheme,
} from "./interaction.js";

const MEDIAPIPE_VERSION = "1.0.1";
const MEDIAPIPE_MODULE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/+esm`;
const MEDIAPIPE_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const STORAGE_KEY = "eyesay-eye-profile-v5";
const DEFAULT_SETTINGS = Object.freeze({ openThreshold: 0.24, closedThreshold: 0.4 });
const $ = (selector) => document.querySelector(selector);

const elements = {
  pages: [...document.querySelectorAll("[data-page]")],
  routes: [...document.querySelectorAll("[data-route]")],
  cameraCard: $("#cameraCard"), remoteCard: $("#remoteCard"),
  video: $("#cameraVideo"), canvas: $("#cameraOverlay"), cameraPlaceholder: $("#cameraPlaceholder"),
  cameraButton: $("#cameraButton"), calibrateButton: $("#calibrateButton"), trackingBadge: $("#trackingBadge"),
  signalIcon: $("#signalIcon"), signalTitle: $("#signalTitle"), signalDetail: $("#signalDetail"),
  leftEyeFill: $("#leftEyeFill"), rightEyeFill: $("#rightEyeFill"), leftEyeText: $("#leftEyeText"), rightEyeText: $("#rightEyeText"),
  leftThresholdMark: $("#leftThresholdMark"), rightThresholdMark: $("#rightThresholdMark"),
  gestureOverlay: $("#gestureOverlay"), gestureOverlayTitle: $("#gestureOverlayTitle"), gestureOverlayDetail: $("#gestureOverlayDetail"),
  mainMessageOutput: $("#mainMessageOutput"), chatMessageOutput: $("#chatMessageOutput"), characterCount: $("#characterCount"),
  undoButton: $("#undoButton"), clearButton: $("#clearButton"), scanToggle: $("#scanToggle"), scanToggleText: $("#scanToggleText"),
  currentChoice: $("#currentChoice"), choiceHint: $("#choiceHint"), bankTabs: $("#bankTabs"), characterGrid: $("#characterGrid"), winkProgress: $("#winkProgress"),
  thresholdValue: $("#thresholdValue"), calibrationModal: $("#calibrationModal"), calibrationVisual: $("#calibrationVisual"),
  calibrationTitle: $("#calibrationTitle"), calibrationInstruction: $("#calibrationInstruction"), calibrationCountdown: $("#calibrationCountdown"),
  calibrationProgress: $("#calibrationProgress"), cancelCalibration: $("#cancelCalibration"), toastRegion: $("#toastRegion"),
};

function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) }; }
  catch { return { ...DEFAULT_SETTINGS }; }
}

let settings = loadSettings();
const scanner = new RemoteScanner();
const winkResolver = new BlinkCommandResolver();
const blinkEngine = new BlinkEngine({ openThreshold: settings.openThreshold, closedThreshold: settings.closedThreshold });
let currentPage = "home";
let lastContentBankId = "consonants";
let message = "";
let chatPanel = null;
let faceLandmarker = null;
let mediaStream = null;
let animationFrame = null;
let lastVideoTime = -1;
let faceIsPresent = false;
let controlsEnabled = false;
let calibration = null;
let lastRawEyeScore = 0;

function saveSettings() { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); }
function setTrackingStatus(kind, label) { elements.trackingBadge.className = `status-badge is-${kind}`; elements.trackingBadge.lastChild.textContent = label; }
function setSignal(title, detail, icon = "○") { elements.signalTitle.textContent = title; elements.signalDetail.textContent = detail; elements.signalIcon.textContent = icon; }
function toast(text, type = "info") { const item = document.createElement("div"); item.className = `toast${type === "error" ? " is-error" : ""}`; item.textContent = text; elements.toastRegion.append(item); setTimeout(() => item.remove(), 3400); }

function banksForPage() { return CHARACTER_BANKS.map((bank) => ({ ...bank, items: [...bank.items] })); }

function dockEyeControls(page) {
  if (page === "home") {
    $("#homeCameraSlot").append(elements.cameraCard);
    $("#homeRemoteSlot").append(elements.remoteCard);
  } else if (page === "chat") {
    $("#chatCameraSlot").append(elements.cameraCard);
    $("#chatRemoteSlot").append(elements.remoteCard);
  }
}

function navigate(page, { updateHash = true } = {}) {
  if (!elements.pages.some((item) => item.dataset.page === page)) page = "home";
  currentPage = page;
  elements.pages.forEach((item) => { const active = item.dataset.page === page; item.hidden = !active; item.classList.toggle("is-active", active); });
  elements.routes.forEach((item) => item.classList.toggle("is-active", item.dataset.route === page));
  winkResolver.cancel();
  elements.winkProgress.hidden = true;
  scanner.replaceBanks(banksForPage(page));
  scanner.setBank(lastContentBankId, performance.now());
  dockEyeControls(page);
  if (controlsEnabled && ["home", "chat"].includes(page)) scanner.start(performance.now());
  else scanner.pause();
  renderBanks(); renderCharacterGrid(); renderCurrentChoice();
  if (updateHash) history.replaceState(null, "", `#${page}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderMessage() {
  for (const output of [elements.mainMessageOutput, elements.chatMessageOutput].filter(Boolean)) if (output.value !== message) output.value = message;
  elements.characterCount.textContent = `${Array.from(message).length} ตัวอักษร`;
  elements.undoButton.disabled = !message; elements.clearButton.disabled = !message;
  chatPanel?.refresh();
}

function renderBanks() {
  elements.bankTabs.replaceChildren();
  scanner.banks.forEach((bank) => {
    const button = document.createElement("button");
    button.type = "button"; button.className = "bank-tab"; button.role = "tab"; button.dataset.bankId = bank.id; button.textContent = bank.label;
    button.setAttribute("aria-selected", String(bank.id === scanner.bank.id));
    button.addEventListener("click", () => { winkResolver.cancel(); lastContentBankId = bank.id; scanner.setBank(bank.id, performance.now()); if (controlsEnabled) scanner.start(performance.now()); renderBanks(); renderCharacterGrid(); renderCurrentChoice(); });
    elements.bankTabs.append(button);
  });
}

function renderCharacterGrid() {
  elements.characterGrid.replaceChildren();
  elements.characterGrid.classList.remove("is-action");
  scanner.bank.items.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button"; button.className = `character-key${index === scanner.itemIndex ? " is-active" : ""}`; button.textContent = item; button.setAttribute("aria-label", `เลือก ${item}`);
    button.addEventListener("click", () => {
      scanner.selectIndex(index, performance.now());
      applySelection(item); scanner.advance(performance.now());
      renderCharacterGrid(); renderCurrentChoice();
    });
    elements.characterGrid.append(button);
  });
}

function renderCurrentChoice() {
  elements.currentChoice.textContent = scanner.item;
  elements.currentChoice.classList.remove("is-action");
  elements.choiceHint.textContent = !mediaStream ? "รอเปิดกล้อง" : !faceIsPresent ? "กำลังค้นหาใบหน้า" : !controlsEnabled ? "ระบบเลือกหยุดอยู่" : "กำลังเลื่อนอัตโนมัติ · สองตาเลือก · ตาเดียวเร่ง";
}

function updateActiveKey() {
  const keys = elements.characterGrid.querySelectorAll(".character-key");
  keys.forEach((key, index) => key.classList.toggle("is-active", index === scanner.itemIndex));
  keys[scanner.itemIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function applySelection(token) {
  message = applyToken(message, token); renderMessage();
  setSignal(`เลือก “${token}” แล้ว`, "พร้อมรับคำสั่งถัดไป", "✓");
}

function startSelection() { if (!mediaStream) return toast("เปิดกล้องก่อนเริ่มควบคุม", "error"); controlsEnabled = true; if (["home", "chat"].includes(currentPage)) scanner.start(performance.now()); updateScanButton(); renderCurrentChoice(); setSignal("พร้อมรับคำสั่ง", "ระบบเลื่อนทุก 1.2 วินาที · หลับสองตาเพื่อเลือก", "◉"); }
function stopSelection() { controlsEnabled = false; scanner.pause(); winkResolver.cancel(); elements.winkProgress.hidden = true; updateScanButton(); renderCurrentChoice(); setSignal("หยุดระบบเลือกแล้ว", "กล้องยังเปิดอยู่ กดเริ่มเมื่อต้องการใช้ต่อ", "Ⅱ"); toast("หยุดระบบเลือกแล้ว"); }
function updateScanButton() { elements.scanToggle.setAttribute("aria-pressed", String(controlsEnabled)); elements.scanToggleText.textContent = controlsEnabled ? "หยุดควบคุม" : "เริ่มควบคุม"; elements.scanToggle.firstElementChild.textContent = controlsEnabled ? "Ⅱ" : "▶"; }

function renderWinkPending() { scanner.pause(); elements.winkProgress.hidden = false; elements.winkProgress.querySelectorAll("i").forEach((dot, i) => dot.classList.toggle("is-detected", i === 0)); elements.choiceHint.textContent = "หลับสองตาอีกครั้งใน 0.46 วิ เพื่อสลับหมวด"; }

function handleBothBlink(event) {
  if (!controlsEnabled || calibration) return;
  const action = winkResolver.record(event.timestamp, scanner.item, "both");
  if (action.type === "pending-select") return renderWinkPending();
  if (action.type === "switch-bank") {
    scanner.nextBank(event.timestamp);
    lastContentBankId = scanner.bank.id;
    elements.winkProgress.hidden = true;
    renderBanks(); renderCharacterGrid(); renderCurrentChoice();
    scanner.start(event.timestamp);
    setSignal(`เปลี่ยนเป็นหมวด “${scanner.bank.label}”`, "กลับไปเลื่อนด้วยความเร็วปกติ", "↻");
  }
}

function handleHoldStep(event) {
  if (!controlsEnabled || calibration) return;
  winkResolver.cancel(); elements.winkProgress.hidden = true;
  scanner.advance(event.timestamp); updateActiveKey(); renderCurrentChoice();
  elements.gestureOverlay.hidden = false; elements.gestureOverlayTitle.textContent = "กำลังเร่งความเร็ว"; elements.gestureOverlayDetail.textContent = `0.2 วิ/ตัว · ปัจจุบัน “${scanner.item}”`;
}

function resolvePendingWink(timestamp) {
  const action = winkResolver.resolve(timestamp);
  if (!action || !controlsEnabled) return;
  elements.winkProgress.hidden = true; applySelection(action.candidate); scanner.advance(timestamp); scanner.start(timestamp); updateActiveKey(); renderCurrentChoice();
}

function processAutoScan(timestamp) {
  if (!controlsEnabled || !faceIsPresent || calibration || !["home", "chat"].includes(currentPage) || winkResolver.deadline !== null) return;
  if (blinkEngine.getTelemetry(timestamp).gesture) return;
  if (scanner.tick(timestamp)) { updateActiveKey(); renderCurrentChoice(); }
}

function processBlinkEvents(events, timestamp) {
  for (const event of events) {
    if (calibration && !["tracking-found", "tracking-lost"].includes(event.type)) continue;
    if (event.type === "tracking-found") { faceIsPresent = true; if (controlsEnabled && ["home", "chat"].includes(currentPage)) scanner.start(timestamp); setTrackingStatus("ready", "พบใบหน้า"); setSignal("ตรวจจับดวงตาแล้ว", "ระบบเลื่อนอัตโนมัติพร้อมใช้งาน", "✓"); renderCurrentChoice(); }
    else if (event.type === "tracking-lost") { faceIsPresent = false; scanner.pause(); winkResolver.cancel(); setTrackingStatus("searching", "หาใบหน้า"); setSignal("ไม่พบใบหน้า", "ระบบพักรับคำสั่งชั่วคราว", "!"); renderCurrentChoice(); }
    else if (event.type === "wink") { scanner.start(event.timestamp); setSignal("ตรวจพบตาข้างเดียว", "ขยิบสั้นข้างเดียวไม่มีคำสั่ง เพื่อกันการเลือกผิด", "◐"); }
    else if (event.type === "hold-step") handleHoldStep(event);
    else if (event.type === "hold-end") { elements.gestureOverlay.hidden = true; scanner.start(event.timestamp); renderCurrentChoice(); }
    else if (event.type === "both-blink") handleBothBlink(event);
    else if (event.type === "both-hold" && controlsEnabled) { elements.gestureOverlay.hidden = true; stopSelection(); }
    else if (event.type === "both-hold-ended") elements.gestureOverlay.hidden = true;
  }
  resolvePendingWink(timestamp);
}

function drawEyeContours(landmarks) {
  const ctx = elements.canvas.getContext("2d"); ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height); if (!landmarks) return;
  const eyes = [[33,160,158,133,153,144],[362,385,387,263,373,380]];
  ctx.strokeStyle = "#8fe0c8"; ctx.lineWidth = Math.max(2, elements.canvas.width / 320); ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 4;
  for (const eye of eyes) { ctx.beginPath(); eye.forEach((index, pointIndex) => { const point = landmarks[index]; const x = point.x * elements.canvas.width; const y = point.y * elements.canvas.height; pointIndex ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.stroke(); }
}

function getBlendshapeScores(result) {
  const categories = result.faceBlendshapes?.[0]?.categories; if (!categories) return null;
  const scores = Object.fromEntries(categories.map((item) => [item.categoryName, item.score]));
  return { left: scores.eyeBlinkLeft ?? 0, right: scores.eyeBlinkRight ?? 0 };
}

function updateTelemetry(timestamp) {
  const telemetry = blinkEngine.getTelemetry(timestamp);
  for (const eye of ["left", "right"]) { const percent = Math.round(telemetry[eye] * 100); elements[`${eye}EyeFill`].style.width = `${percent}%`; elements[`${eye}EyeText`].textContent = `${percent}%`; }
  if (telemetry.gesture === "both" && telemetry.closedForMs > 300) { elements.gestureOverlay.hidden = false; elements.gestureOverlayTitle.textContent = "หลับตาสองข้าง"; elements.gestureOverlayDetail.textContent = "ลืมตาเพื่อเลือก · ค้าง 0.9 วิ เพื่อหยุด"; }
}

function resizeCanvasToVideo() { if (!elements.video.videoWidth) return; if (elements.canvas.width !== elements.video.videoWidth) elements.canvas.width = elements.video.videoWidth; if (elements.canvas.height !== elements.video.videoHeight) elements.canvas.height = elements.video.videoHeight; }

async function createFaceLandmarker() {
  const { FaceLandmarker, FilesetResolver } = await import(MEDIAPIPE_MODULE); const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
  const options = { baseOptions: { modelAssetPath: FACE_MODEL, delegate: "GPU" }, runningMode: "VIDEO", numFaces: 1, minFaceDetectionConfidence: .55, minFacePresenceConfidence: .55, minTrackingConfidence: .55, outputFaceBlendshapes: true };
  try { return await FaceLandmarker.createFromOptions(vision, options); }
  catch (gpuError) { console.warn("GPU unavailable; using CPU", gpuError); return FaceLandmarker.createFromOptions(vision, { ...options, baseOptions: { modelAssetPath: FACE_MODEL } }); }
}

async function predictionLoop(timestamp) {
  if (!mediaStream) return; resizeCanvasToVideo();
  if (faceLandmarker && elements.video.readyState >= 2 && elements.video.currentTime !== lastVideoTime) {
    lastVideoTime = elements.video.currentTime;
    try {
      const result = faceLandmarker.detectForVideo(elements.video, timestamp); const landmarks = result.faceLandmarks?.[0]; const scores = getBlendshapeScores(result); const facePresent = Boolean(landmarks && scores); drawEyeContours(landmarks);
      if (scores) lastRawEyeScore = Math.min(scores.left, scores.right);
      const events = blinkEngine.process({ timestamp, leftScore: scores?.left ?? 0, rightScore: scores?.right ?? 0, facePresent });
      processBlinkEvents(events, timestamp); collectCalibrationFrame(timestamp, facePresent ? lastRawEyeScore : null);
    } catch (error) { console.error(error); }
  }
  resolvePendingWink(timestamp); processAutoScan(timestamp); updateTelemetry(timestamp); animationFrame = requestAnimationFrame(predictionLoop);
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) return toast("เบราว์เซอร์นี้ไม่รองรับกล้อง", "error");
  if (!window.isSecureContext && location.hostname !== "localhost") return toast("กล้องต้องใช้ผ่าน HTTPS หรือ localhost", "error");
  elements.cameraButton.disabled = true; setTrackingStatus("searching", "กำลังโหลด"); setSignal("กำลังเปิดกล้อง", "อนุญาตกล้องเมื่อเบราว์เซอร์ถาม", "…");
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } }, audio: false });
    elements.video.srcObject = mediaStream; await elements.video.play(); elements.cameraPlaceholder.hidden = true; faceLandmarker ??= await createFaceLandmarker();
    elements.cameraButton.textContent = "ปิดกล้อง"; elements.calibrateButton.disabled = false; elements.scanToggle.disabled = false; controlsEnabled = true; scanner.start(performance.now()); blinkEngine.reset(); updateScanButton(); setTrackingStatus("searching", "หาใบหน้า"); animationFrame = requestAnimationFrame(predictionLoop);
  } catch (error) { console.error(error); stopCamera(); toast(error?.name === "NotAllowedError" ? "กรุณาอนุญาตกล้อง" : "เปิดกล้องไม่สำเร็จ", "error"); }
  finally { elements.cameraButton.disabled = false; }
}

function stopCamera() {
  if (animationFrame) cancelAnimationFrame(animationFrame); animationFrame = null; mediaStream?.getTracks().forEach((track) => track.stop()); mediaStream = null; elements.video.srcObject = null; elements.cameraPlaceholder.hidden = false; elements.cameraButton.textContent = "เปิดกล้อง"; elements.calibrateButton.disabled = true; elements.scanToggle.disabled = true; controlsEnabled = false; faceIsPresent = false; scanner.pause(); winkResolver.cancel(); blinkEngine.reset(); drawEyeContours(null); setTrackingStatus("idle", "ยังไม่เริ่ม"); setSignal("พร้อมเริ่มต้น", "จัดหน้าให้อยู่กลางภาพและมีแสงเพียงพอ", "○"); updateScanButton(); renderCurrentChoice();
}

const CALIBRATION_PHASES = [
  { duration:1800,title:"เตรียมลืมตาตามปกติ",instruction:"มองตรง ไม่ต้องเบิกตากว้าง",eye:"open" },
  { duration:2500,title:"ลืมตาตามปกติ",instruction:"กำลังเก็บค่าขณะลืมตา",eye:"open",collect:"open" },
  { duration:1800,title:"เตรียมหลับตา",instruction:"เมื่อเริ่มนับ ให้หลับตาแบบสบาย ๆ",eye:"closed" },
  { duration:2500,title:"หลับตาค้างไว้",instruction:"กำลังเก็บค่าขณะหลับตา",eye:"closed",collect:"closed" },
];
function startCalibration() { if (!mediaStream || !faceIsPresent) return toast("ต้องตรวจพบใบหน้าก่อนปรับเทียบ", "error"); controlsEnabled = false; scanner.pause(); winkResolver.cancel(); blinkEngine.reset(); calibration = { phaseIndex:0,phaseStartedAt:performance.now(),openSamples:[],closedSamples:[] }; elements.calibrationModal.hidden = false; updateCalibrationUI(performance.now()); }
function collectCalibrationFrame(timestamp, score) { if (!calibration) return; const phase = CALIBRATION_PHASES[calibration.phaseIndex]; if (phase.collect && Number.isFinite(score)) calibration[`${phase.collect}Samples`].push(score); updateCalibrationUI(timestamp); if (timestamp - calibration.phaseStartedAt >= phase.duration) { calibration.phaseIndex += 1; calibration.phaseStartedAt = timestamp; if (calibration.phaseIndex >= CALIBRATION_PHASES.length) finishCalibration(); } }
function updateCalibrationUI(timestamp) { if (!calibration) return; const phase = CALIBRATION_PHASES[calibration.phaseIndex]; const elapsed = Math.max(0,timestamp-calibration.phaseStartedAt); elements.calibrationTitle.textContent=phase.title; elements.calibrationInstruction.textContent=phase.instruction; elements.calibrationCountdown.textContent=Math.max(1,Math.ceil((phase.duration-elapsed)/1000)); elements.calibrationProgress.style.width=`${Math.min(100,elapsed/phase.duration*100)}%`; elements.calibrationVisual.classList.toggle("is-closed",phase.eye==="closed"); }
function finishCalibration() { const result=deriveCalibration(calibration.openSamples,calibration.closedSamples); calibration=null; elements.calibrationModal.hidden=true; if(!result.ok){toast("ปรับเทียบไม่สำเร็จ ลองเพิ่มแสง", "error"); blinkEngine.reset(); return;} settings.openThreshold=Number(result.openThreshold.toFixed(3)); settings.closedThreshold=Number(result.closedThreshold.toFixed(3)); blinkEngine.configure(settings); blinkEngine.reset(); saveSettings(); renderGuide(); controlsEnabled=true; scanner.start(performance.now()); updateScanButton(); toast("ปรับเทียบดวงตาสำเร็จ"); }
function cancelCalibration(){calibration=null;elements.calibrationModal.hidden=true;blinkEngine.reset();controlsEnabled=true;scanner.start(performance.now());updateScanButton();}
function renderGuide(){const percent=`${Math.round(settings.closedThreshold*100)}%`;elements.thresholdValue.textContent=percent;elements.leftThresholdMark.style.left=percent;elements.rightThresholdMark.style.left=percent;}

elements.routes.forEach((route)=>route.addEventListener("click",(event)=>{event.preventDefault();navigate(route.dataset.route);}));
window.addEventListener("hashchange",()=>navigate(location.hash.slice(1)||"home",{updateHash:false}));
elements.cameraButton.addEventListener("click",()=>mediaStream?stopCamera():startCamera()); elements.calibrateButton.addEventListener("click",startCalibration); elements.cancelCalibration.addEventListener("click",cancelCalibration);
elements.scanToggle.addEventListener("click",()=>controlsEnabled?stopSelection():startSelection());
elements.undoButton.addEventListener("click",()=>{message=removeLastGrapheme(message);renderMessage();}); elements.clearButton.addEventListener("click",()=>{message="";renderMessage();toast("ล้างข้อความแล้ว");});
for(const output of [elements.mainMessageOutput,elements.chatMessageOutput].filter(Boolean)) output.addEventListener("input",()=>{message=output.value;renderMessage();});
document.addEventListener("keydown",(event)=>{if(event.code==="Space"&&event.target===document.body){event.preventDefault();applySelection(scanner.item);scanner.advance(performance.now());updateActiveKey();renderCurrentChoice();}if((event.ctrlKey||event.metaKey)&&event.key==="Enter"&&currentPage==="chat")void chatPanel?.send();});
window.addEventListener("beforeunload",()=>stopCamera());

if ($("#page-chat")) {
  import("./supabase-chat.js").then(({ mountSupabaseChat }) => {
    chatPanel = mountSupabaseChat({
      getMessage:()=>message,
      onSent:()=>{message="";renderMessage();},
      onSendStatus:(text,bad)=>{setSignal("สถานะแชต",text,bad?"!":"↗");toast(text,bad?"error":"info");},
      onAvailability:()=>renderCurrentChoice(),
    });
    renderMessage();
  }).catch((error)=>toast(`เปิดแชตในเครื่องไม่สำเร็จ: ${error.message}`,"error"));
}

renderMessage(); renderGuide(); updateScanButton(); navigate(location.hash.slice(1)||"home",{updateHash:false});
