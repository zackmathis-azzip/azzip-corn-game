import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const sharp = require("next/node_modules/sharp");

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const input = path.join(root, "public/sponsors/old-major-transparent.png");
const output = path.join(root, "public/sponsors/old-major-wordmark.png");

function isRed(r, g, b) {
  return r >= 60 && r > g + 12 && r > b + 12;
}

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({
  resolveWithObject: true,
});

const out = Buffer.from(data);
for (let i = 0; i < data.length; i += info.channels) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];

  if (!isRed(r, g, b)) {
    out[i + 3] = 0;
    continue;
  }

  out[i] = r;
  out[i + 1] = g;
  out[i + 2] = b;
  out[i + 3] = 255;
}

await sharp(out, {
  raw: { width: info.width, height: info.height, channels: info.channels },
})
  .png()
  .toFile(output);

console.log("Wrote", output);
