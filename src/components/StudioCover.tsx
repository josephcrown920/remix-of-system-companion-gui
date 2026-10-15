import { ArrowRight, Clapperboard, Film, Images, Plus, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import exposure from "@/assets/reel-double-exposure.jpeg.asset.json";
import lilies from "@/assets/reel-waterlilies.jpeg.asset.json";
import hero from "@/assets/hero-triptych.jpg";
import thumbUpscale from "@/assets/thumb-upscale.jpg";
import thumbMotion from "@/assets/thumb-motion.jpg";
import thumbLipsync from "@/assets/thumb-lipsync.jpg";
import thumbMatch from "@/assets/thumb-matchcut.jpg";

export function StudioCover({ children, onWorkspace, onNew, onIdea }: {
  children: React.ReactNode;
  onWorkspace: () => void;
  onNew: () => void;
  onIdea: (idea: string) => void;
}) {
  const start = () => {
    document.getElementById("creative-start")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    document.querySelector<HTMLTextAreaElement>('[aria-label="Creative brief"]')?.focus({ preventScroll: true });
  };
  const releases = [
    { img: thumbUpscale, title: "Upscaler", tag: "4K", text: "Detail-preserving scaling with real skin texture", idea: "Upscale my image to 4K and restore real skin pores and detail. " },
    { img: thumbMotion, title: "Motion", tag: "SYNTH", text: "Character motion control and camera moves", idea: "Animate my character with a slow dolly-in and motion trails. " },
    { img: thumbLipsync, title: "Lip Sync", tag: "VOICE", text: "Match a face to your vocals and lyrics", idea: "Lip sync my performer to my track for a music video. " },
    { img: thumbMatch, title: "Match Cut", tag: "VFX", text: "Same subject, new worlds on every beat", idea: "Create a match cut: keep my subject locked while locations and outfits change on the beat. " },
  ];
  return (
    <main className="studio-cover flex flex-1 flex-col">
      <section className="cover-scene relative isolate overflow-hidden">
        <img src={hero} alt="Three cinematic editorial portraits side by side" width={1920} height={1088} className="cover-photo absolute inset-0 h-full w-full object-cover" />
        <div className="cover-shade absolute inset-0" />
        <div className="cover-copy relative z-10 mx-auto w-full max-w-7xl px-6 sm:px-12">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-foreground/20 bg-background/40 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] backdrop-blur-xl"><Clapperboard className="size-3.5 text-accent" /> The realistic AI creative studio</p>
          <h1 className="font-display text-5xl font-bold leading-[0.95] tracking-tight sm:text-7xl">Make AI <span className="text-foreground/50">(</span>Films<span className="text-foreground/50">)</span><br />Look Real.</h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-foreground/80">Generate images and video, lip sync, motion control and match cuts — with a whole creative crew in one place.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={start} className="h-12 rounded-full bg-accent px-6 font-bold uppercase text-accent-foreground hover:bg-accent/90">Start now <ArrowRight className="size-4" /></Button>
            <Button onClick={onWorkspace} variant="outline" className="h-12 rounded-full border-foreground/25 bg-background/30 px-6 font-bold uppercase backdrop-blur-xl">Open studio <ArrowUpRight className="size-4" /></Button>
          </div>
          <div className="mt-10 flex gap-5 font-mono text-[10px] uppercase tracking-wider text-foreground/70"><span>01 / Imagine</span><span>02 / Direct</span><span>03 / Create</span></div>
        </div>
      </section>
      <section className="mx-auto w-full max-w-7xl px-6 pt-12 sm:px-12">
        <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">Pro tools & models</p>
        <h2 className="mb-6 mt-2 font-display text-3xl font-bold">Latest releases</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {releases.map((r) => (
            <Button key={r.title} variant="ghost" onClick={() => { onIdea(r.idea); start(); }} className="group block h-auto overflow-hidden rounded-xl border border-border bg-card/40 p-0 text-left whitespace-normal">
              <img src={r.img} alt={r.title} loading="lazy" width={816} height={816} className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="p-4"><p className="text-sm font-bold uppercase">{r.title} <span className="ml-1 font-mono text-[9px] text-accent">{r.tag}</span></p><p className="mt-2 text-xs text-muted-foreground">{r.text}</p><p className="mt-3 flex items-center gap-1 text-xs font-bold uppercase text-muted-foreground group-hover:text-foreground">Launch <ArrowRight className="size-3" /></p></div>
            </Button>
          ))}
        </div>
      </section>
      <section id="creative-start" className="mx-auto grid w-full max-w-7xl scroll-mt-16 gap-10 px-6 py-9 sm:px-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-16">
        <div className="min-w-0">
          <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <span className="flex items-center gap-2 text-xs font-semibold"><Clapperboard className="size-4 text-accent" /> Director’s desk</span>
            <Button variant="ghost" size="sm" onClick={onNew} className="text-muted-foreground"><Plus className="size-3" /> New chat</Button>
          </div>
          <h2 className="mb-6 font-display text-3xl font-bold">What’s your next vision?</h2>
          {children}
        </div>
        <aside className="min-w-0">
          <div className="mb-5 flex items-center justify-between border-b border-border pb-4"><span className="text-xs font-semibold">A little inspiration</span><span className="font-mono text-[9px] text-muted-foreground">SELECTED FRAMES / 02</span></div>
          <div className="grid grid-cols-2 gap-3">
            {[{ asset: exposure, label: "Double exposure", type: "FILM / PORTRAIT", icon: Film, idea: "Create a cinematic double-exposure portrait with warm rim light and a dreamy, analog-film mood. " }, { asset: lilies, label: "Paint a world", type: "IMAGE / ART", icon: Images, idea: "Create a painterly water-lily scene with pink flowers, rich green leaves and reflected blue sky. " }].map((item) => (
              <Button key={item.label} variant="ghost" onClick={() => { onIdea(item.idea); start(); }} className="group relative block h-auto overflow-hidden rounded-md border border-border p-0 text-left whitespace-normal">
                <img src={item.asset.url} alt={item.label} className="aspect-[3/4] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="inspiration-shade absolute inset-0" />
                <div className="absolute inset-x-0 bottom-0 p-3"><p className="mb-2 font-mono text-[8px] text-foreground/75">{item.type}</p><p className="flex items-center justify-between text-sm font-semibold">{item.label}<ArrowUpRight className="size-4" /></p></div>
              </Button>
            ))}
          </div>
          <p className="mt-5 border-t border-border pt-4 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Your vision takes the lead.</p>
        </aside>
      </section>
    </main>
  );
}
