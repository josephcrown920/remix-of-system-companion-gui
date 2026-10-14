import { useState } from "react";
import { Loader2, Mic2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateVideo } from "@/lib/generate";

/** Lip sync: a face photo + a voice track become a talking clip. */
export function LipSync({ onDone }: { onDone: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [face, setFace] = useState<File>();
  const [audio, setAudio] = useState<File>();
  const [line, setLine] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function run() {
    if (!face || !audio || busy) return;
    setBusy(true);
    setStatus("Starting…");
    try {
      const url = await generateVideo(
        `Lip sync: animate the person in the photo speaking the attached audio with accurate mouth shapes, natural blinks and subtle head motion. ${line}`,
        "",
        "Static camera, close-up, face stays identical to the photo.",
        { image: face, audio, onStatus: setStatus },
      );
      onDone(url);
      setStatus("Done — added to your timeline.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Lip sync failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        className="flex h-8 min-w-8 shrink-0 items-center gap-1.5 rounded-md border border-border px-2 sm:px-2.5 sm:py-1.5 sm:text-xs font-bold"
      >
        <Mic2 className="size-3.5" />
        <span className="hidden sm:inline">Lip sync</span>
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="glass-panel w-full max-w-md space-y-3 rounded-xl border border-border bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Lip sync</h2>
              <button onClick={() => setOpen(false)} aria-label="Close">
                <X className="size-4" />
              </button>
            </div>
            <label className="block text-xs text-muted-foreground">
              Face photo
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFace(e.target.files?.[0])}
                className="mt-1 block w-full text-xs"
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Voice / audio
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => setAudio(e.target.files?.[0])}
                className="mt-1 block w-full text-xs"
              />
            </label>
            <input
              value={line}
              onChange={(e) => setLine(e.target.value)}
              placeholder="Optional: mood or expression"
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            />
            <Button
              onClick={() => void run()}
              disabled={!face || !audio || busy}
              className="w-full"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Make it talk"}
            </Button>
            {status && <p className="text-xs text-muted-foreground">{status}</p>}
            <p className="text-[11px] text-muted-foreground">
              OmniHuman will power this once your ModelArk account is active.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
