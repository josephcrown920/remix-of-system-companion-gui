/** Loaded only on a user action, never during server rendering. */
export async function removeImageBackground(source: string, onProgress?: (value: string) => void): Promise<string> {
  const { removeBackground } = await import("@imgly/background-removal");
  const response = await fetch(source);
  if (!response.ok) throw new Error("Could not open this image.");
  const blob = await removeBackground(await response.blob(), {
    model: "isnet_quint8",
    device: "cpu",
    output: { format: "image/png", quality: 1 },
    progress: (_key, current, total) => onProgress?.(total ? `Preparing cutout · ${Math.round(current / total * 100)}%` : "Removing background…"),
  });
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not save cutout."));
    reader.onerror = () => reject(new Error("Could not save cutout."));
    reader.readAsDataURL(blob);
  });
}