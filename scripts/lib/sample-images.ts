import { crc32, deflateSync } from "node:zlib";

/** Plain tonal PNG used for SAMPLE catalogue/gallery photos in demo data. Not photography, not anyone's product. */
export function samplePng(width: number, height: number, top: [number, number, number], bottom: [number, number, number]): Uint8Array {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const t = y / (height - 1);
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      // faint vertical "grain" so the swatch does not look like a flat error colour
      const grain = Math.sin(x * 0.35 + y * 0.01) * 4;
      for (let c = 0; c < 3; c++) raw[row + 1 + x * 3 + c] = Math.max(0, Math.min(255, Math.round(top[c]! + (bottom[c]! - top[c]!) * t + grain)));
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}
