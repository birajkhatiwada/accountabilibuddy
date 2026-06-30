const Jimp = require('jimp')
const path = require('path')

async function main() {
  const src = path.resolve(__dirname, '../Gemini_Generated_Image_tn84lgtn84lgtn84.png')
  const out = path.resolve(__dirname, '../src/assets/cat-sprites.png')

  const img = await Jimp.read(src)
  const w = img.getWidth()
  const h = img.getHeight()
  console.log(`Image: ${w}×${h}`)

  let removed = 0
  img.scan(0, 0, w, h, (x, y, idx) => {
    const r = img.bitmap.data[idx]
    const g = img.bitmap.data[idx + 1]
    const b = img.bitmap.data[idx + 2]

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    // HSV saturation — 0 for pure gray/white, high for orange/coloured
    const sat = max === 0 ? 0 : (max - min) / max

    // Remove achromatic (gray/white) pixels that are not very dark (keep black outlines)
    if (sat < 0.12 && max > 100) {
      img.bitmap.data[idx + 3] = 0
      removed++
    }
  })

  console.log(`Removed ${removed.toLocaleString()} pixels`)
  await img.writeAsync(out)
  console.log(`Saved → ${out}`)
}

main().catch(err => { console.error(err); process.exit(1) })
