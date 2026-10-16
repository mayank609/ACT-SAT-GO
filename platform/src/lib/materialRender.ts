import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { pathToFileURL } from 'url'
import { createCanvas, type SKRSContext2D } from '@napi-rs/canvas'

// Server-side PDF rendering for protected study materials. Viewers who may not
// download a material never receive the PDF itself — only page images with
// their name burned in as a watermark, rendered here with pdf.js.

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs')
type PdfDoc = Awaited<ReturnType<PdfJs['getDocument']>['promise']>

let pdfjsPromise: Promise<PdfJs> | null = null
function pdfjs(): Promise<PdfJs> {
  pdfjsPromise ??= import('pdfjs-dist/legacy/build/pdf.mjs')
  return pdfjsPromise
}

// Fonts/CMaps for PDFs that don't embed them (file:// URLs, trailing slash
// required). Found on disk at runtime — require.resolve is rewritten by the
// bundler — walking up from the app directory like Node's own lookup.
let pdfjsDir: string | null = null
function assetUrl(sub: string): string {
  if (!pdfjsDir) {
    let dir = process.cwd()
    while (!existsSync(join(dir, 'node_modules', 'pdfjs-dist', 'package.json')) && dirname(dir) !== dir) dir = dirname(dir)
    pdfjsDir = join(dir, 'node_modules', 'pdfjs-dist')
  }
  return pathToFileURL(join(pdfjsDir, sub)).href + '/'
}

async function openPdf(data: Uint8Array): Promise<PdfDoc> {
  const lib = await pdfjs()
  return lib.getDocument({
    // pdf.js transfers (detaches) the buffer it is given — always hand it a copy.
    data: new Uint8Array(data),
    standardFontDataUrl: assetUrl('standard_fonts'),
    cMapUrl: assetUrl('cmaps'),
    cMapPacked: true,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  }).promise
}

export interface PdfInfo { pageCount: number; pages: Array<[number, number]> }

/** Validates a PDF and reads its page sizes (in points). Throws on a broken/encrypted file. */
export async function inspectPdf(data: Uint8Array): Promise<PdfInfo> {
  const doc = await openPdf(data)
  try {
    const pages: Array<[number, number]> = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const vp = page.getViewport({ scale: 1 })
      pages.push([Math.round(vp.width), Math.round(vp.height)])
      page.cleanup()
    }
    return { pageCount: doc.numPages, pages }
  } finally {
    await doc.destroy()
  }
}

// A few recently used documents stay parsed, so paging through one is fast.
const DOC_CACHE_MAX = 6
const docCache = new Map<string, Promise<PdfDoc>>()

async function cachedDoc(key: string, load: () => Promise<Uint8Array>): Promise<PdfDoc> {
  let hit = docCache.get(key)
  if (hit) {
    docCache.delete(key)
    docCache.set(key, hit) // most recently used goes last
    return hit
  }
  hit = load().then(openPdf)
  hit.catch(() => docCache.delete(key))
  docCache.set(key, hit)
  while (docCache.size > DOC_CACHE_MAX) {
    const [oldKey, oldDoc] = docCache.entries().next().value as [string, Promise<PdfDoc>]
    docCache.delete(oldKey)
    oldDoc.then((d) => d.destroy()).catch(() => {})
  }
  return hit
}

/** Drops a material from the render cache (after delete/replace). */
export function forgetDoc(key: string) {
  for (const k of imageCache.keys()) if (k.startsWith(`${key}|`)) imageCache.delete(k)
  const hit = docCache.get(key)
  docCache.delete(key)
  hit?.then((d) => d.destroy()).catch(() => {})
}

function drawWatermark(ctx: SKRSContext2D, w: number, h: number, text: string) {
  const size = Math.max(14, Math.round(w / 38))
  ctx.save()
  ctx.font = `600 ${size}px sans-serif`
  ctx.fillStyle = 'rgba(30, 41, 59, 0.11)'
  ctx.textBaseline = 'middle'
  ctx.translate(w / 2, h / 2)
  ctx.rotate(-Math.PI / 6)
  const tw = ctx.measureText(text).width + size * 4
  const step = size * 5.5
  const reach = Math.hypot(w, h)
  for (let y = -reach / 2; y < reach / 2; y += step) {
    const offset = (Math.round(y / step) % 2) * (tw / 2)
    for (let x = -reach / 2 - offset; x < reach / 2; x += tw) ctx.fillText(text, x, y)
  }
  ctx.restore()
  // A clear line at the bottom so a cropped screenshot still names the viewer.
  ctx.save()
  const small = Math.max(11, Math.round(w / 90))
  ctx.font = `500 ${small}px sans-serif`
  ctx.fillStyle = 'rgba(30, 41, 59, 0.45)'
  ctx.textAlign = 'right'
  ctx.fillText(text, w - small, h - small)
  ctx.restore()
}

export const RENDER_WIDTHS = [800, 1200, 1600] as const

// Finished page images, so scrolling back and forth doesn't re-render.
const IMAGE_CACHE_MAX = 120
const imageCache = new Map<string, Buffer>()

/** Renders one page (1-based) to WebP at about `width` pixels wide, watermarked with `watermark`. */
export async function renderPage(
  key: string,
  load: () => Promise<Uint8Array>,
  pageNumber: number,
  width: number,
  watermark: string,
): Promise<Buffer> {
  const imageKey = `${key}|${pageNumber}|${width}|${watermark}`
  const hit = imageCache.get(imageKey)
  if (hit) return hit
  const doc = await cachedDoc(key, load)
  if (pageNumber < 1 || pageNumber > doc.numPages) throw new RangeError('page out of range')
  const page = await doc.getPage(pageNumber)
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: width / base.width })
  const w = Math.ceil(viewport.width)
  const h = Math.ceil(viewport.height)
  const canvas = createCanvas(w, h)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  // pdf.js accepts any 2D context that implements the canvas API.
  await page.render({ canvas: canvas as unknown as HTMLCanvasElement, canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport }).promise
  page.cleanup()
  drawWatermark(ctx, w, h, watermark)
  const image = await canvas.encode('webp', 82)
  imageCache.set(imageKey, image)
  if (imageCache.size > IMAGE_CACHE_MAX) imageCache.delete(imageCache.keys().next().value as string)
  return image
}
