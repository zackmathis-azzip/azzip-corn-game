import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const sharp = require("next/node_modules/sharp");

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const input = path.join(root, "public/sponsors/old-major.png");
const artOut = path.join(root, "public/sponsors/old-major-art.png");
const typeOut = path.join(root, "public/sponsors/old-major-type.png");

function lum(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function isRed(r, g, b) {
  return r >= 55 && r > g + 10 && r > b + 10;
}

function processPixels(data, channels, mode) {
  const out = Buffer.from(data);
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const l = lum(r, g, b);

    if (mode === "type") {
      if (!isRed(r, g, b) || l < 20) {
        out[i + 3] = 0;
        continue;
      }
      out[i] = Math.min(255, r + 40);
      out[i + 1] = Math.max(0, g - 8);
      out[i + 2] = Math.max(0, b - 8);
      out[i + 3] = Math.min(230, Math.round((l - 18) * 2.8));
      continue;
    }

    // Art — white ink from gray line work; drop red bleed and black matte
    if (isRed(r, g, b) || l < 14) {
      out[i + 3] = 0;
      continue;
    }

    const ink = Math.min(255, Math.round((l - 14) * 4.2));
    if (ink < 8) {
      out[i + 3] = 0;
      continue;
    }

    out[i] = 235;
    out[i + 1] = 228;
    out[i + 2] = 218;
    out[i + 3] = ink;
  }
  return out;
}

async function writeProcessed(extract, output, mode) {
  const pipeline = sharp(input).extract(extract).ensureAlpha().raw();
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  const out = processPixels(data, info.channels, mode);
  await sharp(out, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .png()
    .toFile(output);
  console.log("Wrote", output, `${info.width}x${info.height}`);
}

const meta = await sharp(input).metadata();
const width = meta.width ?? 500;
const height = meta.height ?? 249;
const artWidth = Math.round(width * 0.46);
const typeLeft = Math.round(width * 0.4);
const typeWidth = width - typeLeft;

await writeProcessed({ left: 0, top: 0, width: artWidth, height }, artOut, "art");
await writeProcessed({ left: typeLeft, top: 0, width: typeWidth, height }, typeOut, "type");
