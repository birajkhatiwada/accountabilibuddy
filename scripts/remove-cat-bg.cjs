const Jimp = require('jimp')
const path = require('path')

async function main() {
  const src = path.resolve(__dirname, '../Gemini_Generated_Image_tn84lgtn84lgtn84.png')
  const out = path.resolve(__dirname, '../src/assets/cat-sprites.png')

  const img = await Jimp.read(src)
  const w = img.getWidth()
  const h = img.getHeight()
  console.log(`Image: ${w}×${h}`)

  const data = img.bitmap.data

  const getPixel = (x, y) => {
    const i = (y * w + x) * 4
    return [data[i], data[i+1], data[i+2], data[i+3]]
  }
  const setTransparent = (x, y) => {
    const i = (y * w + x) * 4
    data[i+3] = 0
  }

  // A pixel is "background" if it's light and achromatic (low saturation)
  const isBg = (x, y) => {
    const [r, g, b, a] = getPixel(x, y)
    if (a === 0) return true
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    const sat = max === 0 ? 0 : (max - min) / max
    return sat < 0.15 && max > 90
  }

  // Flood fill from a set of seed points.
  // Seeds placed at: all 4 edges (every Npx), and between sprite cells.
  const COLS = 8, ROWS = 4
  const cellW = w / COLS, cellH = h / ROWS

  const seeds = new Set()
  const addSeed = (x, y) => {
    x = Math.max(0, Math.min(w-1, Math.round(x)))
    y = Math.max(0, Math.min(h-1, Math.round(y)))
    seeds.add(y * w + x)
  }

  // Edges — every 20px
  for (let x = 0; x < w; x += 20) { addSeed(x, 0); addSeed(x, h-1) }
  for (let y = 0; y < h; y += 20) { addSeed(0, y); addSeed(w-1, y) }

  // Grid intersections (gaps between sprites)
  for (let col = 0; col <= COLS; col++) {
    for (let row = 0; row <= ROWS; row++) {
      addSeed(col * cellW, row * cellH)
      // Also seed slightly inside each gap on both sides
      addSeed(col * cellW - 2, row * cellH)
      addSeed(col * cellW + 2, row * cellH)
      addSeed(col * cellW, row * cellH - 2)
      addSeed(col * cellW, row * cellH + 2)
    }
  }
  // Mid-cell edge points (top/bottom of each sprite row, between columns)
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row <= ROWS; row++) {
      addSeed((col + 0.5) * cellW, row * cellH)
    }
  }
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col <= COLS; col++) {
      addSeed(col * cellW, (row + 0.5) * cellH)
    }
  }

  console.log(`Seeds: ${seeds.size}`)

  // BFS flood fill
  const visited = new Uint8Array(w * h)
  const queue = []
  for (const idx of seeds) {
    const x = idx % w, y = Math.floor(idx / w)
    if (!visited[idx] && isBg(x, y)) {
      visited[idx] = 1
      queue.push(idx)
    }
  }

  let removed = 0, qi = 0
  while (qi < queue.length) {
    const idx = queue[qi++]
    const x = idx % w, y = Math.floor(idx / w)
    setTransparent(x, y)
    removed++

    for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
      const ni = ny * w + nx
      if (visited[ni]) continue
      visited[ni] = 1
      if (isBg(nx, ny)) queue.push(ni)
    }
  }

  console.log(`Removed ${removed.toLocaleString()} background pixels`)
  await img.writeAsync(out)
  console.log(`Saved → ${out}`)
}

main().catch(err => { console.error(err); process.exit(1) })
