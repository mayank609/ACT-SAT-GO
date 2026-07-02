const sharp = require('sharp');
const path = require('path');

const src = path.resolve(__dirname, 'src/assets/cta.png');
const out = path.resolve(__dirname, 'src/assets/cta-flood.png');

const LOCAL_THRESHOLD = 20; // max local RGB distance to keep flooding
const CONFIDENT_BG_X_END = 700; // fully seed this whole left strip as background

async function main() {
  const image = sharp(src);
  const { data, info } = await image.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const visited = new Uint8Array(width * height); // 0 = unknown, 1 = background, 2 = kept(subject)
  const alpha = new Uint8Array(width * height).fill(255);

  function idx(x, y) { return y * width + x; }
  function colorAt(x, y) {
    const i = idx(x, y) * channels;
    return [data[i], data[i + 1], data[i + 2]];
  }
  function dist(c1, c2) {
    return Math.sqrt((c1[0] - c2[0]) ** 2 + (c1[1] - c2[1]) ** 2 + (c1[2] - c2[2]) ** 2);
  }

  // BFS queue (array-based, using index pointer instead of shift for perf)
  const queue = new Int32Array(width * height);
  let qHead = 0, qTail = 0;

  // Seed the confident background strip
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < CONFIDENT_BG_X_END; x++) {
      const p = idx(x, y);
      if (!visited[p]) {
        visited[p] = 1;
        alpha[p] = 0;
        queue[qTail++] = p;
      }
    }
  }

  while (qHead < qTail) {
    const p = queue[qHead++];
    const x = p % width;
    const y = (p / width) | 0;
    const c0 = colorAt(x, y);

    const neighbors = [
      [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const np = idx(nx, ny);
      if (visited[np]) continue;
      const c1 = colorAt(nx, ny);
      if (dist(c0, c1) <= LOCAL_THRESHOLD) {
        visited[np] = 1;
        alpha[np] = 0;
        queue[qTail++] = np;
      }
    }
  }

  // Apply alpha with a small feather: pixels bordering removed background get partial alpha
  // to soften jagged edges (simple 1-pass dilation-based feather).
  const finalAlpha = new Uint8Array(alpha);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = idx(x, y);
      if (alpha[p] === 255) {
        // count removed neighbors within a 2px radius
        let removedCount = 0;
        let total = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            total++;
            if (alpha[idx(nx, ny)] === 0) removedCount++;
          }
        }
        if (removedCount > 0) {
          const frac = removedCount / total;
          finalAlpha[p] = Math.round(255 * (1 - frac * 0.6));
        }
      }
    }
  }

  for (let p = 0; p < width * height; p++) {
    data[p * channels + 3] = finalAlpha[p];
  }

  await sharp(data, { raw: { width, height, channels } }).png().toFile(out);
  console.log('done ->', out);

  let bgCount = 0;
  for (let i = 0; i < alpha.length; i++) if (alpha[i] === 0) bgCount++;
  console.log('background pixels removed:', bgCount, '/', width * height, `(${((bgCount / (width*height))*100).toFixed(1)}%)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
