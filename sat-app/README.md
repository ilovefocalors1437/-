# SAT Math Practice (Android)

An offline practice app for the digital SAT **Math** section, modelled on the test-day experience.
It lives in this folder and is independent of the rest of the repository.

## Install

Every push that touches `sat-app/` builds the APK with GitHub Actions
(`.github/workflows/sat-apk.yml`) and publishes it as the release **`sat-apk-latest`**:

1. On the phone, open the repository's **Releases** page and download `SAT-Math-Practice.apk`.
2. Open the file and allow "install unknown apps" for the browser/file manager when Android asks.

All builds are signed with the same key (`android/sideload.keystore`), so a newer APK installs over
the old one and keeps saved tests and history. That key is public in this repo — fine for a personal
sideloaded app, not for a store release.

## What it does

- **Two modules × 22 questions, 35 minutes each**, no break between them — like the real Math section.
- **Adaptive**: Module 1 mixes easy/medium/hard. 14 or more correct routes to the harder Module 2,
  otherwise the easier one.
- **Scoring (200–800)** uses an item-response model (`www/js/engine.js`): every question has a
  difficulty, discrimination and guessing parameter and the score is the ability estimate that best
  explains the whole answer pattern. Hard questions are worth more; on the easier Module 2 the top of
  the scale is unreachable. It is an estimate, not an official score.
- **Pause**: stops the clock, saves, and blacks out the screen with a single *Unpause* button.
  Leaving the app pauses automatically. **Autosave** after every action; a killed app resumes paused.
- Test tools: mark for review, answer eliminator, question navigator, review page, reference sheet,
  hide-timer, five-minute warning, automatic module end when time runs out.
- **Calculator**: built-in graphing calculator and scientific calculator (`www/calc/`).
- Student-produced responses are checked with the SAT grid-in rules (equivalent fractions/decimals,
  truncated or rounded long decimals).
- Results: score, per-domain breakdown, and every question with the correct answer and explanation.

## Question bank

`www/data/questions.js` holds original SAT-style questions written for this app (they are not copied
from College Board material). They are generated and verified by the scripts in `tools/questions/`.

## Develop

```
node tools/selftest.js        # engine + question bank checks
node tools/e2e.js             # full UI run-through in headless Chromium (needs Playwright)
node tools/sim-score.js       # print the score scale for sample answer patterns
cd android && gradle assembleRelease   # needs the Android SDK
```

The app is a plain web app in `www/` (open `www/index.html` in a browser) wrapped by a small
WebView activity in `android/`.
