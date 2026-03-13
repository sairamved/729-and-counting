const { createCanvas, registerFont } = require("canvas");
const fs = require("fs");
const path = require("path");

// ── Register custom fonts ──
registerFont(path.join(__dirname, "NationalPark-Regular.ttf"), { family: "NationalPark" });
registerFont(path.join(__dirname, "NationalPark-ExtraBold.ttf"), { family: "NationalPark", weight: "bold" });

// ── Color palette ──
const PINK_BG = "#fbe5e5";
const PURPLE = "#7053ad";

// ── Degree-based trig (matching p5 angleMode(DEGREES)) ──
const DEG = Math.PI / 180;
function sinD(d) { return Math.sin(d * DEG); }
function cosD(d) { return Math.cos(d * DEG); }

// ── Flower math — exact copy from sketch.js ──
function vShape(A, r, a, b) {
  return A * Math.pow(Math.E, -b * Math.pow(Math.abs(r), 1.5)) * Math.pow(Math.abs(r), a);
}

function perturbation(A, r, p, angle) {
  return 1 + A * Math.pow(r, 2) * sinD(p * angle);
}

// Generate the 3D flower vertices exactly as sketch.js does
function flowerPoints3D(numPetals, petalScale, stemLen, heightOffset, tStep, pStep) {
  const pts = [];
  for (let theta = 0; theta < 60 - tStep; theta += tStep) {
    for (let phi = 0; phi <= 360; phi += pStep) {
      let p = phi % 360;
      for (let t = 0; t < 2; t++) {
        let th = theta + t * tStep;
        let r = (petalScale * Math.pow(Math.abs(sinD(p * (numPetals / 2))), 1) + 225) * (th / 60);
        let x = r * cosD(p);
        let y = r * sinD(p);
        let z = vShape(stemLen, r / 100, 0.8, 0.15) - 200 + perturbation(1.5, r / 100, 12, p) + heightOffset;
        pts.push({ x, y, z });
      }
    }
  }
  return pts;
}

// ── 3D rotation (radians) ──
function rotate3D(x, y, z, rx, ry, rz) {
  // Rotate around X
  let y1 = y * Math.cos(rx) - z * Math.sin(rx);
  let z1 = y * Math.sin(rx) + z * Math.cos(rx);
  // Rotate around Y
  let x2 = x * Math.cos(ry) + z1 * Math.sin(ry);
  let z2 = -x * Math.sin(ry) + z1 * Math.cos(ry);
  // Rotate around Z
  let x3 = x2 * Math.cos(rz) - y1 * Math.sin(rz);
  let y3 = x2 * Math.sin(rz) + y1 * Math.cos(rz);
  return { x: x3, y: y3, z: z2 };
}

// Draw a 3D flower rotated and projected onto 2D canvas
function drawFlower(ctx, cx, cy, scale, numPetals, petalScale, stemLen, heightOffset, opacity, rx, ry, rz) {
  const pts = flowerPoints3D(numPetals, petalScale, stemLen, heightOffset, 1, 2);
  const pr = parseInt(PURPLE.slice(1, 3), 16);
  const pg = parseInt(PURPLE.slice(3, 5), 16);
  const pb = parseInt(PURPLE.slice(5, 7), 16);

  for (const p of pts) {
    const rot = rotate3D(p.x, p.y, p.z, rx, ry, rz);
    const sx = cx + rot.x * scale;
    const sy = cy + rot.y * scale;
    // Use z for depth-based alpha
    const depthAlpha = Math.max(0.08, Math.min(1, (rot.z + 400) / 600));
    const a = depthAlpha * opacity;
    ctx.fillStyle = `rgba(${pr},${pg},${pb},${a})`;
    const dotSize = Math.max(0.5, scale * 3);
    ctx.beginPath();
    ctx.arc(sx, sy, dotSize, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ────────────────────────────────────────────────────────────
// 1.  FAVICON  (32 x 32)
// ────────────────────────────────────────────────────────────
function generateFavicon() {
  const size = 32;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = PINK_BG;
  ctx.fillRect(0, 0, size, size);

  // Render at 4x then downscale for crisp favicon with visible shading
  const hiRes = 128;
  const hiCanvas = createCanvas(hiRes, hiRes);
  const hctx = hiCanvas.getContext("2d");
  hctx.fillStyle = PINK_BG;
  hctx.fillRect(0, 0, hiRes, hiRes);

  const numPetals = 8;
  const hiScale = 0.18;
  const hcx = hiRes / 2, hcy = hiRes / 2;

  // Draw flower rings — alternating dark/light purple like the sketch's triangle strip
  for (let theta = 0; theta < 59; theta += 1) {
    // Alternate between dark and lighter purple per ring
    const isLight = theta % 3 === 0;
    const cr = isLight ? 140 : 112;
    const cg = isLight ? 110 : 83;
    const cb = isLight ? 210 : 173;

    for (let phi = 0; phi <= 360; phi += 2) {
      let p = phi % 360;
      for (let t = 0; t < 2; t++) {
        let th = theta + t;
        let r = (60 * Math.pow(Math.abs(sinD(p * (numPetals / 2))), 1) + 225) * (th / 60);
        let x = r * cosD(p);
        let y = r * sinD(p);
        let sx = hcx + x * hiScale;
        let sy = hcy + y * hiScale;
        let a = isLight ? 0.55 : 0.75;
        hctx.fillStyle = `rgba(${cr},${cg},${cb},${a})`;
        hctx.beginPath();
        hctx.arc(sx, sy, Math.max(1, hiScale * 3), 0, Math.PI * 2);
        hctx.fill();
      }
    }
  }

  // Downscale to 32x32
  ctx.drawImage(hiCanvas, 0, 0, size, size);

  const buf = canvas.toBuffer("image/png");
  fs.writeFileSync("favicon.png", buf);
  console.log("  favicon.png (%d bytes)", buf.length);
}

// ────────────────────────────────────────────────────────────
// 2.  OG IMAGE  (1200 x 630)
// ────────────────────────────────────────────────────────────
function generateOGImage() {
  const W = 1200;
  const H = 630;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = PINK_BG;
  ctx.fillRect(0, 0, W, H);

  // ── Single flower, right side, tilted ──
  drawFlower(ctx, W * 0.72, H * 0.55, 0.44, 7, 80, 350, -50, 0.5, 0.85, 0.55, 0.3);

  // ── Typography — left-aligned, vertically centered ──
  const textBlockH = 224;
  const leftMargin = W * 0.09;
  const baselineY = (H - textBlockH) / 2 + 108;

  // "729"
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = PURPLE;
  ctx.font = "bold 120px NationalPark";
  ctx.fillText("729", leftMargin, baselineY);

  // "(and counting)"
  ctx.font = "36px NationalPark";
  ctx.fillStyle = "rgba(112, 83, 173, 0.65)";
  ctx.fillText("(and counting)", leftMargin + 4, baselineY + 50);

  // Divider line
  ctx.strokeStyle = "rgba(112, 83, 173, 0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(leftMargin, baselineY + 72);
  ctx.lineTo(leftMargin + 340, baselineY + 72);
  ctx.stroke();

  // Subtitle
  ctx.font = "bold 32px NationalPark";
  ctx.fillStyle = "rgba(112, 83, 173, 0.55)";
  ctx.fillText("Femicide Data Visualization", leftMargin, baselineY + 116);

  const buf = canvas.toBuffer("image/png");
  fs.writeFileSync("og-image.png", buf);
  console.log("  og-image.png (%d bytes)", buf.length);
}

// ── Run ──
console.log("Generating assets...");
generateFavicon();
generateOGImage();
console.log("Done.");
