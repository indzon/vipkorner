export type MediaUpload = {
  kind: "image" | "video";
  extension: "jpg" | "png" | "webp" | "gif" | "mp4" | "webm" | "mov";
  contentType: string;
};

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function fromSignature(bytes: Uint8Array): MediaUpload | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { kind: "image", extension: "jpg", contentType: "image/jpeg" };
  if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === "PNG") return { kind: "image", extension: "png", contentType: "image/png" };
  if (ascii(bytes, 0, 3) === "GIF") return { kind: "image", extension: "gif", contentType: "image/gif" };
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return { kind: "image", extension: "webp", contentType: "image/webp" };
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return { kind: "video", extension: "webm", contentType: "video/webm" };
  if (ascii(bytes, 4, 4) === "ftyp") {
    const quickTime = ascii(bytes, 8, 4) === "qt  ";
    return quickTime
      ? { kind: "video", extension: "mov", contentType: "video/quicktime" }
      : { kind: "video", extension: "mp4", contentType: "video/mp4" };
  }
  return null;
}

export async function inspectMediaUpload(file: File): Promise<MediaUpload | null> {
  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const detected = fromSignature(bytes);
  if (detected) return detected;

  const extension = file.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (file.type.startsWith("video/") || ["mp4", "webm", "mov", "m4v"].includes(extension || "")) {
    if (file.type === "video/webm" || extension === "webm") return { kind: "video", extension: "webm", contentType: "video/webm" };
    if (file.type === "video/quicktime" || extension === "mov") return { kind: "video", extension: "mov", contentType: "video/quicktime" };
    return { kind: "video", extension: "mp4", contentType: "video/mp4" };
  }
  if (file.type.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif"].includes(extension || "")) {
    if (file.type === "image/png" || extension === "png") return { kind: "image", extension: "png", contentType: "image/png" };
    if (file.type === "image/webp" || extension === "webp") return { kind: "image", extension: "webp", contentType: "image/webp" };
    if (file.type === "image/gif" || extension === "gif") return { kind: "image", extension: "gif", contentType: "image/gif" };
    return { kind: "image", extension: "jpg", contentType: "image/jpeg" };
  }
  return null;
}
