/**
 * Turns the source media in media/work/<slug>/ into what the site serves.
 *
 *   media/work/<slug>/*            sources (not served)
 *   public/work/<slug>/            generated: <id>.thumb.webp + <id>.full.<ext>
 *   content/work-media.generated.json   manifest read by content/gallery.ts
 *
 * Per file:
 *   - thumb: static first frame, WebP. The pile shows it, and it is the
 *     placeholder under the carousel slide until the full asset is ready.
 *   - video (mp4/webm/mov): copied if it is already small H.264, otherwise
 *     re-encoded to H.264 MP4 (no audio, faststart, max 1600px wide). The thumb
 *     is cut from the *output*, so both come from the same decode.
 *   - animated image (gif/webp): copied as is.
 *   - still image: resized to fit 1800px, WebP.
 *
 * Files whose outputs are newer than the source are skipped. Optional
 * media/work/<slug>/meta.json: { "<file name>": { "alt": "…" } }.
 *
 * Runs on predev/prebuild. See docs/work-image-stack-carousel.md.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(root, "media", "work");
const OUT = path.join(root, "public", "work");
const MANIFEST = path.join(root, "content", "work-media.generated.json");

const THUMB_EDGE = 480;
const FULL_EDGE = 1800;
const VIDEO_MAX_WIDTH = 1600;
/**
 * Already-H.264 videos within these limits are copied untouched. This is also
 * what stops an optimised file in media/ being re-encoded (and degraded again)
 * on every fresh build.
 */
const VIDEO_COPY_LIMIT = 2.5 * 1024 * 1024;

const VIDEO_EXT = new Set([".mp4", ".webm", ".mov", ".m4v"]);
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"]);

const mtime = async (file) => {
  try {
    return (await stat(file)).mtimeMs;
  } catch {
    return 0;
  }
};

/** ffmpeg exits non-zero when given only an input; the info is on stderr. */
async function probeVideo(file) {
  let stderr = "";
  try {
    await run(ffmpegPath, ["-hide_banner", "-i", file]);
  } catch (error) {
    stderr = String(error.stderr ?? "");
  }
  const codec = /Video:\s*([a-z0-9_]+)/i.exec(stderr)?.[1]?.toLowerCase();
  const pixFmt = /Video:[^\n]*?,\s*(yuv\w+)/i.exec(stderr)?.[1];
  const width = Number(/Video:[^\n]*?,\s*(\d{3,5})x\d{3,5}/i.exec(stderr)?.[1]);
  return { codec, pixFmt, width };
}

const prettify = (id) =>
  id
    .replace(/^\d+[-_]?/, "")
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());

async function processVideo(src, id, outDir) {
  const out = path.join(outDir, `${id}.full.mp4`);
  const { codec, pixFmt, width: srcWidth } = await probeVideo(src);
  const { size } = await stat(src);
  const reusable =
    path.extname(src).toLowerCase() === ".mp4" &&
    codec === "h264" &&
    pixFmt === "yuv420p" &&
    srcWidth <= VIDEO_MAX_WIDTH &&
    size <= VIDEO_COPY_LIMIT;

  if (reusable) {
    await copyFile(src, out);
  } else {
    await run(ffmpegPath, [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      src,
      "-an",
      "-vf",
      `scale=w='min(${VIDEO_MAX_WIDTH},iw)':h=-2`,
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "27",
      "-pix_fmt",
      "yuv420p",
      "-colorspace",
      "bt709",
      "-color_primaries",
      "bt709",
      "-color_trc",
      "bt709",
      "-movflags",
      "+faststart",
      out,
    ]);
  }

  // First frame of the output, so thumb and playback share a decode.
  const frame = path.join(outDir, `${id}.frame.png`);
  await run(ffmpegPath, [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    out,
    "-frames:v",
    "1",
    frame,
  ]);
  const thumb = path.join(outDir, `${id}.thumb.webp`);
  const info = await sharp(frame)
    .resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: "inside" })
    .webp({ quality: 80 })
    .toFile(thumb);
  const { width, height } = await sharp(frame).metadata();
  await unlink(frame);

  return {
    kind: "video",
    animated: true,
    width,
    height,
    full: path.basename(out),
    thumb: path.basename(thumb),
    thumbSize: info.size,
    mode: reusable ? "copied" : "encoded",
  };
}

async function processImage(src, id, outDir) {
  const ext = path.extname(src).toLowerCase();
  const meta = await sharp(src, { animated: true }).metadata();
  const animated = (meta.pages ?? 1) > 1;
  const width = meta.width;
  const height = meta.pageHeight ?? meta.height;

  const thumb = path.join(outDir, `${id}.thumb.webp`);
  const info = await sharp(src, { animated: false })
    .rotate()
    .resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: "inside" })
    .webp({ quality: 80 })
    .toFile(thumb);

  let fullName;
  if (animated) {
    fullName = `${id}.full${ext}`;
    await copyFile(src, path.join(outDir, fullName));
  } else {
    fullName = `${id}.full.webp`;
    await sharp(src)
      .rotate()
      .resize({ width: FULL_EDGE, height: FULL_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(outDir, fullName));
  }

  return {
    kind: "image",
    animated,
    width,
    height,
    full: fullName,
    thumb: path.basename(thumb),
    thumbSize: info.size,
    mode: animated ? "copied" : "encoded",
  };
}

async function processGallery(slug) {
  const srcDir = path.join(SOURCE, slug);
  const outDir = path.join(OUT, slug);
  await mkdir(outDir, { recursive: true });

  let alts = {};
  try {
    alts = JSON.parse(await readFile(path.join(srcDir, "meta.json"), "utf8"));
  } catch {}

  const files = (await readdir(srcDir))
    .filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return VIDEO_EXT.has(ext) || IMAGE_EXT.has(ext);
    })
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const entries = [];
  for (const file of files) {
    const src = path.join(srcDir, file);
    const ext = path.extname(file).toLowerCase();
    const id = path.basename(file, ext);
    const cache = path.join(outDir, `${id}.json`);

    let built = null;
    if ((await mtime(cache)) > (await mtime(src))) {
      try {
        built = JSON.parse(await readFile(cache, "utf8"));
      } catch {}
    }
    if (!built) {
      process.stdout.write(`  ${slug}/${file} … `);
      built = VIDEO_EXT.has(ext)
        ? await processVideo(src, id, outDir)
        : await processImage(src, id, outDir);
      await writeFile(cache, JSON.stringify(built));
      const fullSize = (await stat(path.join(outDir, built.full))).size;
      console.log(
        `${built.mode} ${(fullSize / 1024).toFixed(0)}KB, thumb ${(built.thumbSize / 1024).toFixed(0)}KB`,
      );
    }

    const url = (name) => `/work/${slug}/${name}`;
    entries.push({
      id,
      alt: alts[file]?.alt ?? prettify(id),
      kind: built.kind,
      animated: built.animated,
      width: built.width,
      height: built.height,
      thumbSrc: url(built.thumb),
      src: url(built.full),
    });
  }
  return entries;
}

const manifest = {};
let slugs = [];
try {
  slugs = (await readdir(SOURCE, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
} catch {
  console.log("work media: no media/work folder, writing an empty manifest");
}
for (const slug of slugs) manifest[slug] = await processGallery(slug);

await mkdir(path.dirname(MANIFEST), { recursive: true });
await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
console.log(
  `work media: ${Object.values(manifest).flat().length} items in ${slugs.length} galleries`,
);
