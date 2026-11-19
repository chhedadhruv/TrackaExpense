// Builds assets/icon-monochrome.png from assets/icon-foreground.png. Run it with
//
//   node scripts/make-monochrome-icon.js
//
// after changing the foreground artwork, then commit the new PNG. It needs `pngjs`, which is
// already in node_modules through Expo's image tools (it is not a dependency of this app).
//
// Android 13 themed icons use only the alpha of this layer and tint it with the wallpaper colours.
// The foreground is a white mark with a dark blue rupee and a lighter blue dotted ring on the coin.
// Here every white part becomes solid, the rupee becomes a transparent cut-out, and the dotted ring
// is filled in (its dashes would shrink to a faint speckle at launcher size). The mark is scaled
// slightly so it sits inside the 66 percent safe circle that `CLAUDE.md` asks for. The colours and
// sizes below are measured from the current foreground: if the artwork changes, the script stops
// with an error instead of writing a wrong icon.
const fs = require('fs');
const path = require('path');
const {PNG} = require('pngjs');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'icon-foreground.png');
const OUT = path.join(ROOT, 'assets', 'icon-monochrome.png');

const DARK_BLUE_R = 58; // the rupee, (58, 71, 168)
const WHITE_R = 255;
const RING_RGB = [79, 95, 196]; // the dotted ring
const SCALE = 0.97;
const SAFE_RADIUS = (1024 * 0.66) / 2;

const smoothstep = (lo, hi, v) => {
  const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};

const src = PNG.sync.read(fs.readFileSync(SRC));
const {width, height, data} = src;
if (width !== 1024 || height !== 1024) {
  throw new Error(`expected 1024x1024, got ${width}x${height}`);
}

// The coin centre: the dashes of the ring are spread evenly, so their mean position is the centre.
let sx = 0;
let sy = 0;
let n = 0;
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const i = (y * width + x) * 4;
    if (
      data[i + 3] === 255 &&
      Math.abs(data[i] - RING_RGB[0]) < 4 &&
      Math.abs(data[i + 1] - RING_RGB[1]) < 4 &&
      Math.abs(data[i + 2] - RING_RGB[2]) < 4
    ) {
      sx += x;
      sy += y;
      n += 1;
    }
  }
}
if (n < 500) {
  throw new Error(
    `ring not found (${n} pixels): the foreground colours changed`,
  );
}
const coinX = sx / n;
const coinY = sy / n;

// Rupee extent: dark blue pixels, to choose how far from the centre the rupee reaches.
let rupeeReach = 0;
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const i = (y * width + x) * 4;
    if (
      data[i + 3] === 255 &&
      data[i] <= DARK_BLUE_R + 2 &&
      data[i + 2] < 180
    ) {
      rupeeReach = Math.max(rupeeReach, Math.hypot(x - coinX, y - coinY));
    }
  }
}
if (rupeeReach === 0) {
  throw new Error('rupee not found: the foreground colours changed');
}
// Inside this radius colour decides (the rupee is cut out); outside it everything is solid.
const CUT_RADIUS = rupeeReach + 12;

// The mask at full size: alpha, with the rupee removed.
const mask = new Float32Array(width * height);
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const i = (y * width + x) * 4;
    const alpha = data[i + 3] / 255;
    let keep = 1;
    if (Math.hypot(x - coinX, y - coinY) <= CUT_RADIUS) {
      // 0 for the dark blue, 1 for white, smooth across the antialiased edge in between.
      keep = smoothstep(
        0.35,
        0.75,
        (data[i] - DARK_BLUE_R) / (WHITE_R - DARK_BLUE_R),
      );
    }
    mask[y * width + x] = alpha * keep;
  }
}

const sample = (fx, fy) => {
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const dx = fx - x0;
  const dy = fy - y0;
  const at = (x, y) =>
    x < 0 || y < 0 || x >= width || y >= height ? 0 : mask[y * width + x];
  return (
    at(x0, y0) * (1 - dx) * (1 - dy) +
    at(x0 + 1, y0) * dx * (1 - dy) +
    at(x0, y0 + 1) * (1 - dx) * dy +
    at(x0 + 1, y0 + 1) * dx * dy
  );
};

// Scale about the canvas centre, then write black with the mask as alpha.
const out = new PNG({width, height});
const cx = width / 2;
const cy = height / 2;
let farthest = 0;
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const a = Math.round(
      sample(cx + (x - cx) / SCALE, cy + (y - cy) / SCALE) * 255,
    );
    const i = (y * width + x) * 4;
    out.data[i] = 0;
    out.data[i + 1] = 0;
    out.data[i + 2] = 0;
    out.data[i + 3] = a;
    if (a > 0) {
      farthest = Math.max(farthest, Math.hypot(x - cx, y - cy));
    }
  }
}
if (farthest > SAFE_RADIUS) {
  throw new Error(
    `the mark reaches ${farthest.toFixed(
      1,
    )} px from the centre, outside the safe radius ${SAFE_RADIUS.toFixed(1)}`,
  );
}
fs.writeFileSync(OUT, PNG.sync.write(out));
console.log(
  `wrote ${path.relative(
    ROOT,
    OUT,
  )}; farthest non-transparent pixel ${farthest.toFixed(
    1,
  )} of ${SAFE_RADIUS.toFixed(1)}`,
);
