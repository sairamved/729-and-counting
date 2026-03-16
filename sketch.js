// ── Constants ─────────────────────────────────
let SPACING = 1600;
const ZOOM_IN_SCALE = 3.5;
const ZOOM_EASE = 0.07;
const ALPHA_EASE = 0.12;

// ── State ─────────────────────────────────────
let data;
let font, fontBold;
let flowers = [];
let currentDay = 0;
let COLS, CAM_Z;

// Interaction
let hoveredFlower = -1;
let focusedFlower = -1;

// Per-flower alpha animation
let fAlpha = [];
let fAlphaTarget = [];
let fAlphaDelay = [];

// Auto-advance timer
let lastAdvanceFrame = 0;

// Zoom
let zScale = 1, zScaleTarget = 1;
let zCX = 0, zCY = 0;           // current zoom center (lerped)
let zCXTarget = 0, zCYTarget = 0;

// ── Seeded RNG ────────────────────────────────
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

function seededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ── p5 lifecycle ──────────────────────────────

function preload() {
  data = loadJSON('data.json');
  font = loadFont('NationalPark-Regular.ttf');
  fontBold = loadFont('NationalPark-ExtraBold.ttf');
}

function setup() {
  let container = document.getElementById('canvas-container');
  let cnv = createCanvas(container.offsetWidth, container.offsetHeight, WEBGL);
  cnv.parent(container);

  angleMode(DEGREES);
  textFont(font);

  recomputeLayout();
  buildFlowers();
  updateDateLabel();
}

// ── Layout computation ────────────────────────

function recomputeLayout() {
  COLS = width < 500 ? 3 : width < 800 ? 4 : 5;

  // The reference used camera z=8000 with p5's default perspective.
  // p5 default: far = defaultCamZ * 10, where defaultCamZ = (h/2)/tan(PI/6).
  // At typical heights, far ≈ 7970 — just BELOW camera z=8000.
  // This means the far plane cuts through the flowers, clipping their backs.
  //
  // We replicate this by: compute CAM_Z to fit the grid, then set
  // far = CAM_Z * ratio so the same proportion of the flower is clipped.
  // In the reference: far/CAM_Z ≈ 7970/8000 ≈ 0.996.
  let defaultCamZ = (height / 2) / Math.tan(Math.PI / 6);

  let maxCount = 14;
  let rows = ceil(maxCount / COLS);
  let maxCols = min(maxCount, COLS);
  let gridW = (maxCols - 1) * SPACING + 1200;
  let gridH = (rows - 1) * SPACING + 1400;
  let tanFOV = Math.tan(Math.PI / 6);
  let aspect = width / height;
  let camZW = (gridW / 2) / (tanFOV * aspect);
  let camZH = (gridH / 2) / tanFOV;
  CAM_Z = max(camZW, camZH) * 1.3;

  // Scale spacing down on very narrow/portrait screens
  let maxFar = defaultCamZ * 10;
  if (CAM_Z > maxFar) {
    let scaleFactor = maxFar / CAM_Z;
    SPACING = 1600 * scaleFactor;
    CAM_Z = maxFar;
  } else {
    SPACING = 1600;
  }
}

// ── Grid centering ────────────────────────────

function flowerPositions(count) {
  let pos = [];
  if (count === 0) return pos;

  let rows = ceil(count / COLS);
  let totalH = (rows - 1) * SPACING;
  let startY = -totalH / 2;

  for (let i = 0; i < count; i++) {
    let row = floor(i / COLS);
    let colsInRow = row < rows - 1 ? COLS : count - row * COLS;
    let col = i - row * COLS;
    let totalW = (colsInRow - 1) * SPACING;
    let startX = -totalW / 2;
    pos.push({
      x: startX + col * SPACING,
      y: startY + row * SPACING,
    });
  }
  return pos;
}

// ── Build flowers for current day ─────────────

function buildFlowers() {
  flowers = [];
  fAlpha = [];
  fAlphaTarget = [];
  fAlphaDelay = [];

  let dayData = data[currentDay];
  if (!dayData) return;

  let count = dayData.count || 0;
  let names = dayData.names || [];
  let positions = flowerPositions(count);

  let abouts = dayData.about || [];

  for (let i = 0; i < count; i++) {
    let name = names[i] || '';
    let rng = seededRng(hashStr(name + i));
    flowers.push({
      name: name,
      about: abouts[i] || '',
      numPetals: floor(rng() * 6 + 4),
      stemLen: rng() * 400 + 200,
      petalScale: rng() * 140 + 60,
      heightOffset: rng() * 200 - 100,
      rotSpeed: rng() * 0.3 + 0.2,
      rotOffset: rng() * 360,
      wx: positions[i].x,
      wy: positions[i].y,
    });
    fAlpha.push(0);
    fAlphaTarget.push(255);
    fAlphaDelay.push(i * 3);
  }

  focusedFlower = -1;
  zScaleTarget = 1;
  zCXTarget = 0;
  zCYTarget = 0;
  hideAboutOverlay();
}

function updateDateLabel() {
  let dayData = data[currentDay];
  if (!dayData) return;
  let d = new Date(dayData.date);
  let formatted = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  if (!window._dateSlots) {
    window._dateSlots = new TextSlots(document.getElementById('date-label'));
  }
  window._dateSlots.update(formatted);
}

// ── About overlay ────────────────────────────

function showAboutOverlay(flowerIndex) {
  let overlay = document.getElementById('about-overlay');
  let textEl = document.getElementById('about-text');
  let about = flowers[flowerIndex].about;
  if (about) {
    textEl.textContent = about;
    overlay.classList.remove('hidden');
    overlay.classList.add('visible');
  } else {
    hideAboutOverlay();
  }
}

function hideAboutOverlay() {
  let overlay = document.getElementById('about-overlay');
  overlay.classList.remove('visible');
  overlay.classList.add('hidden');
}

// ── Draw ──────────────────────────────────────

function draw() {
  // ── Animate zoom ────────────────────────────
  zScale += (zScaleTarget - zScale) * ZOOM_EASE;
  zCX += (zCXTarget - zCX) * ZOOM_EASE;
  zCY += (zCYTarget - zCY) * ZOOM_EASE;

  // Camera Z moves closer when zoomed in
  let camZ = CAM_Z / zScale;

  // Reference clipping: camera z=8000, default far≈7970 → far/camZ ≈ 0.996.
  // The far plane sits just in front of the flower centers, so only the
  // front-facing vertices (closer to camera) are visible — backs get clipped.
  // When zoomed in, ease far out so the focused flower is fully visible.
  let t = constrain((zScale - 1) / (ZOOM_IN_SCALE - 1), 0, 1);
  let clipFar = lerp(camZ * 0.996, camZ * 3, t);
  perspective(60, width / height, 10, clipFar);
  camera(zCX, zCY, camZ, zCX, zCY, 0, 0, 1, 0);

  background('#fbe5e5');

  // Auto-advance every ~6s, only in grid view
  if (frameCount - lastAdvanceFrame >= 360 && focusedFlower === -1 && pendingDay === -1) nextDay();

  // Check if fade-out is done and we need to swap to a new day
  checkPendingDay();

  // ── Hover detection (grid view only) ────────
  hoveredFlower = -1;
  if (focusedFlower === -1 && zScale < 1.1) {
    hoveredFlower = pickFlower(mouseX, mouseY);
  }

  // ── Animate per-flower alpha ────────────────
  for (let i = 0; i < flowers.length; i++) {
    if (fAlphaDelay[i] > 0) {
      fAlphaDelay[i]--;
    } else {
      fAlpha[i] += (fAlphaTarget[i] - fAlpha[i]) * ALPHA_EASE;
    }
  }

  // ── Draw flowers + names ────────────────────
  for (let i = 0; i < flowers.length; i++) {
    let f = flowers[i];
    let a = fAlpha[i];
    if (a < 2) continue;

    let hovered = hoveredFlower === i;

    // Flower
    push();
    translate(f.wx, f.wy, 0);
    rotateY(frameCount * f.rotSpeed + f.rotOffset);
    rotateX(frameCount * f.rotSpeed + f.rotOffset);
    rotateZ(frameCount * f.rotSpeed + f.rotOffset);

    if (width < 600 && focusedFlower === -1) scale(0.65);

    let zoomT = constrain((zScale - 1) / (ZOOM_IN_SCALE - 1), 0, 1);
    if (focusedFlower === -1) {
      // Zoomed out: filled mesh, no stroke
      noStroke();
      if (hovered) {
        fill(140, 110, 210, a);
      } else {
        fill(112, 83, 173, a);
      }
    } else {
      // Zoomed in: points with stroke
      noFill();
      if (hovered) {
        stroke(140, 110, 210, a);
      } else {
        stroke(112, 83, 173, a);
      }
      strokeWeight(0.1);
    }
    drawFlower(f);
    pop();

    // Name beneath flower (above on mobile when zoomed in)
    if (a > 10) {
      push();
      let zt = constrain((zScale - 1) / (ZOOM_IN_SCALE - 1), 0, 1);
      let nameGap = lerp(SPACING * 0.26, SPACING * 1.2, zt) / max(1, zScale);
      let nameY = width < 600 ? f.wy + lerp(nameGap, -nameGap * 1.7, zt) : f.wy + nameGap;
      translate(f.wx, nameY, CAM_Z * 0.01);
      noStroke();
      fill(0, a * 0.3);
      textFont(font);
      let nameSizeMult = width < 600 ? 0.11 : 0.075;
      textSize(SPACING * nameSizeMult / max(1, zScale));
      textAlign(CENTER, CENTER);
      textWrap(WORD);
      let boxW = SPACING * 0.5 / max(1, zScale);
      text(f.name, -boxW / 2, 0, boxW);
      pop();
    }
  }


  // Show/hide back hint
  let hintEl = document.getElementById('back-hint');
  if (focusedFlower !== -1) {
    hintEl.classList.remove('hidden');
  } else {
    hintEl.classList.add('hidden');
  }

  // Cursor
  if (hoveredFlower !== -1) cursor(HAND);
  else cursor(ARROW);
}

// ── Flower geometry (unchanged from reference) ─

function drawFlower(f) {
  let zoomed = focusedFlower !== -1;
  let tStep = zoomed ? 1 : 2;
  let pStep = zoomed ? 2 : 4;
  let shapeMode = zoomed ? POINTS : TRIANGLE_STRIP;

  for (let theta = 0; theta < 60 - tStep; theta += tStep) {
    beginShape(shapeMode);
    for (let phi = 0; phi <= 360; phi += pStep) {
      let p = phi % 360;
      for (let t = 0; t < 2; t++) {
        let th = theta + t * tStep;
        let r =
          (f.petalScale * pow(abs(sin(p * (f.numPetals / 2))), 1) + 225) *
          (th / 60);
        let x = r * cos(p);
        let y = r * sin(p);
        let z =
          vShape(f.stemLen, r / 100, 0.8, 0.15) -
          200 +
          perturbation(1.5, r / 100, 12, p) +
          f.heightOffset;
        vertex(x, y, z);
      }
    }
    endShape();
  }
}

function vShape(A, r, a, b) {
  return A * pow(Math.E, -b * pow(abs(r), 1.5)) * pow(abs(r), a);
}

function perturbation(A, r, p, angle) {
  return 1 + A * pow(r, 2) * sin(p * angle);
}


// ── Hit test: screen → world ──────────────────

function pickFlower(mx, my) {
  let defaultCamZ = (height / 2) / Math.tan(Math.PI / 6);
  let worldPerPx = CAM_Z / defaultCamZ;

  let worldMX = (mx - width / 2) * worldPerPx;
  let worldMY = (my - height / 2) * worldPerPx;

  let hitR = SPACING * 0.3;

  for (let i = 0; i < flowers.length; i++) {
    let dx = worldMX - flowers[i].wx;
    let dy = worldMY - flowers[i].wy;
    if (dx * dx + dy * dy < hitR * hitR) return i;
  }
  return -1;
}

// ── Mouse / touch interaction ─────────────────

function mousePressed(e) {
  // Ignore clicks outside the canvas
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;

  // Ignore clicks on the about overlay
  let overlay = document.getElementById('about-overlay');
  if (e && e.target && overlay.contains(e.target)) return;

  if (focusedFlower !== -1) {
    // Unfocus → zoom out, cancel any pending day transition
    focusedFlower = -1;
    pendingDay = -1;
    zScaleTarget = 1;
    zCXTarget = 0;
    zCYTarget = 0;
    lastAdvanceFrame = frameCount; // reset timer so it doesn't advance immediately
    hideAboutOverlay();
    for (let i = 0; i < flowers.length; i++) {
      fAlphaTarget[i] = 255;
      fAlphaDelay[i] = i * 3;
    }
    return;
  }

  // Block clicks while transitioning or still zooming out
  if (pendingDay !== -1 || zScale > 1.1) return;

  let hit = pickFlower(mouseX, mouseY);
  if (hit !== -1) {
    focusedFlower = hit;
    zScaleTarget = ZOOM_IN_SCALE;
    zCXTarget = flowers[hit].wx;
    zCYTarget = flowers[hit].wy;

    // Immediately hide all other flowers
    for (let i = 0; i < flowers.length; i++) {
      if (i !== hit) {
        fAlpha[i] = 0;
        fAlphaTarget[i] = 0;
      }
    }
    showAboutOverlay(hit);
  }
}

function touchStarted(e) {
  // Forward to mousePressed for mobile
  if (touches.length > 0) {
    // Don't dismiss if touching the about overlay
    let overlay = document.getElementById('about-overlay');
    if (e && e.target && overlay.contains(e.target)) return;
    mouseX = touches[0].x;
    mouseY = touches[0].y;
    mousePressed();
    return false; // prevent default
  }
}

// ── Slider (HTML element) ─────────────────────

document.getElementById('day-slider').addEventListener('input', function () {
  let day = parseInt(this.value);
  // Update date label immediately as slider moves
  let dayData = data[day];
  if (dayData) {
    let d = new Date(dayData.date);
    let formatted = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    if (!window._dateSlots) {
      window._dateSlots = new TextSlots(document.getElementById('date-label'));
    }
    window._dateSlots.update(formatted);
  }
  transitionToDay(day);
});

// ── Day advance ───────────────────────────────

let pendingDay = -1;

function transitionToDay(day) {
  // If zoomed in, reset zoom first
  if (focusedFlower !== -1) {
    focusedFlower = -1;
    zScaleTarget = 1;
    zCXTarget = 0;
    zCYTarget = 0;
    hideAboutOverlay();
  }

  // If no flowers, just build immediately
  if (flowers.length === 0) {
    currentDay = day;
    document.getElementById('day-slider').value = currentDay;
    buildFlowers();
    updateDateLabel();
    return;
  }
  // Stagger-fade out current flowers, then swap
  pendingDay = day;
  for (let i = 0; i < flowers.length; i++) {
    fAlphaTarget[i] = 0;
    fAlphaDelay[i] = i * 2;
  }
}

function checkPendingDay() {
  if (pendingDay === -1) return;
  // Wait until all flowers have faded out
  let allOut = true;
  for (let i = 0; i < flowers.length; i++) {
    if (fAlpha[i] > 5) { allOut = false; break; }
  }
  if (allOut) {
    currentDay = pendingDay;
    pendingDay = -1;
    lastAdvanceFrame = frameCount;
    document.getElementById('day-slider').value = currentDay;
    buildFlowers();
    updateDateLabel();
  }
}

function nextDay() {
  transitionToDay((currentDay + 1) % 232);
}

// ── Responsive ────────────────────────────────

function windowResized() {
  let container = document.getElementById('canvas-container');
  resizeCanvas(container.offsetWidth, container.offsetHeight);
  recomputeLayout();

  // Re-measure slot widths for new font size
  if (window._dateSlots) window._dateSlots.remeasure();

  // Recompute flower positions for new COLS
  let dayData = data[currentDay];
  if (dayData) {
    let positions = flowerPositions(dayData.count || 0);
    for (let i = 0; i < flowers.length; i++) {
      if (positions[i]) {
        flowers[i].wx = positions[i].x;
        flowers[i].wy = positions[i].y;
      }
    }
  }
}
