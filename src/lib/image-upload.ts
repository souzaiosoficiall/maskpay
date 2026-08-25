/** Read file from gallery/camera and return compressed JPEG data URL. */
export async function fileToCompressedDataUrl(
  file: File,
  maxSide = 1280,
  quality = 0.82,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecione uma imagem válida.");
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("Imagem muito grande (máx. 12 MB).");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", quality);
}
