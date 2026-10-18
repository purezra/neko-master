// Usage: node scripts/generate-icons.mjs <source.png> (run from apps/web).
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const localRequire = createRequire(import.meta.url);
const sharp = createRequire(localRequire.resolve("next/package.json"))("sharp");

async function main() {
  const source = process.argv[2];
  if (!source) throw new Error("Source PNG path is required");
  const icons = path.resolve("public/icons");
  await fs.mkdir(icons, { recursive: true });
  await sharp(source).resize(512, 512, { fit: "contain", background: "#00000000" }).png().toFile("public/logo.png");
  for (const size of [72, 96, 128, 144, 152, 192, 384, 512]) {
    await sharp(source).resize(size, size, { fit: "contain", background: "#00000000" }).png().toFile(path.join(icons, `icon-${size}x${size}.png`));
  }
  for (const size of [192, 512]) {
    // Keep the complete circular mark inside the maskable safe zone.
    const inset = Math.round(size * 0.15);
    const mark = await sharp(source).resize(size - inset * 2, size - inset * 2, { fit: "contain", background: "#00000000" }).png().toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background: "#f5f7fa" } }).composite([{ input: mark, gravity: "centre" }]).png().toFile(path.join(icons, `icon-maskable-${size}x${size}.png`));
  }
  const sizes = [16, 32, 48, 256];
  const images = await Promise.all(sizes.map(size => sharp(source).resize(size, size, { fit: "contain", background: "#00000000" }).png().toBuffer()));
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((buffer, index) => {
    const entry = 6 + index * 16;
    header[entry] = sizes[index] % 256; header[entry + 1] = sizes[index] % 256;
    header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(buffer.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
    offset += buffer.length;
  });
  await fs.writeFile("public/logo.ico", Buffer.concat([header, ...images]));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
