import { sequence, buildSequencePrompt, shotCode, type Shot } from "@/lib/layers-storyboard";

export type LayersProject = {
  id: string; name: string; prompt: string; engine: string; videoEngine: string;
  identity: string; identityLock: boolean; resolution: string; shots: Shot[]; updatedAt: number;
};

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("reel-layers-projects", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("projects", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Local project storage is unavailable."));
  });
}

export async function listLayersProjects(): Promise<LayersProject[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("projects").objectStore("projects").getAll();
      request.onsuccess = () => resolve((request.result as LayersProject[]).sort((a, b) => b.updatedAt - a.updatedAt));
      request.onerror = () => reject(new Error("Could not read saved shoots."));
    });
  } finally { db.close(); }
}

export async function storeLayersProject(project: LayersProject): Promise<void> {
  // Imported source/reference files deliberately stay in the active workspace only.
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("projects", "readwrite");
      transaction.objectStore("projects").put({ ...project, shots: sequence(project.shots) });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error("Could not save this shoot. Local storage may be full."));
    });
  } finally { db.close(); }
}

export async function deleteLayersProject(id: string): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("projects", "readwrite");
      transaction.objectStore("projects").delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error("Could not delete this shoot."));
    });
  } finally { db.close(); }
}

export async function downloadLayer(url: string, name: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not download this frame.");
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = objectUrl; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
}

export async function exportLayersProject(project: LayersProject) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const slug = project.name.replace(/[^a-z0-9]+/gi, "-").slice(0, 50) || "aurora-shoot";
  await Promise.all(sequence(project.shots).filter((s) => s.dataUrl).map(async (shot) => {
    const response = await fetch(shot.dataUrl);
    if (!response.ok) throw new Error(`Could not export ${shotCode(shot.order)}.`);
    zip.file(`${slug}/${shotCode(shot.order)}.png`, await response.blob());
  }));
  zip.file(`${slug}/storyboard.txt`, buildSequencePrompt(project.shots, project.identity));
  zip.file(`${slug}/project.json`, JSON.stringify(project, null, 2));
  const url = URL.createObjectURL(await zip.generateAsync({ type: "blob" }));
  const link = document.createElement("a"); link.href = url; link.download = `${slug}.zip`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function loadLayerImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not open a frame for composition."));
    image.src = url;
  });
}

export async function composeLayersSheet(frames: string[]): Promise<string> {
  if (!frames.length) throw new Error("Render a shot before composing a sheet.");
  const images = await Promise.all(frames.map(loadLayerImage));
  const cols = Math.ceil(Math.sqrt(images.length)), rows = Math.ceil(images.length / cols);
  const canvas = document.createElement("canvas"); canvas.width = cols * 512; canvas.height = rows * 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image composition is unavailable.");
  images.forEach((image, index) => {
    const scale = Math.min(512 / image.naturalWidth, 512 / image.naturalHeight);
    const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
    context.drawImage(image, index % cols * 512 + (512 - width) / 2, Math.floor(index / cols) * 512 + (512 - height) / 2, width, height);
  });
  return canvas.toDataURL("image/png");
}

export async function referencePlate(source: string | null, reference: string): Promise<Blob> {
  const [base, identity] = await Promise.all([source ? loadLayerImage(source) : null, loadLayerImage(reference)]);
  const canvas = document.createElement("canvas"); canvas.width = base ? 1536 : 512; canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Reference composition is unavailable.");
  const draw = (image: HTMLImageElement, x: number, cellWidth: number) => {
    const scale = Math.min(cellWidth / image.naturalWidth, 1024 / image.naturalHeight);
    const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
    context.drawImage(image, x + (cellWidth - w) / 2, (1024 - h) / 2, w, h);
  };
  if (base) draw(base, 0, 1024);
  draw(identity, base ? 1024 : 0, 512);
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not prepare identity reference.")), "image/png"));
}