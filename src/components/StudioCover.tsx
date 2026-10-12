import { ArrowRight, Clapperboard, Film, Images, Plus, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import fire from "@/assets/reel-fire-portrait.png.asset.json";
import exposure from "@/assets/reel-double-exposure.jpeg.asset.json";
import lilies from "@/assets/reel-waterlilies.jpeg.asset.json";

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
  return (
    <main className="studio-cover flex flex-1 flex-col">
      <section className="cover-scene relative isolate overflow-hidden">
        <img src={fire.url} alt="Performer illuminated by a burning car on a cinematic night street" className="cover-photo absolute inset-0 h-full w-full object-cover" />
        <div className="cover-shade absolute inset-0" />
        <div className="cover-copy relative z-10 mx-auto w-full max-w-7xl px-6 sm:px-12">
          <p className="mb-6 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em]"><Clapperboard className="size-4 text-accent" /> REEL / THE CREATIVE STUDIO</p>
          <h1 className="font-display text-5xl font-bold leading-none sm:text-7xl">Reel.<br /><span className="text-accent">Beyond the frame.</span></h1>
          <p className="mt-6 max-w-xs text-sm leading-relaxed text-foreground/80">Your imagination. A whole creative crew.<br />One place to make it real.</p>
          <div className="mt-8 flex gap-3">
            <Button onClick={start} className="h-11 bg-accent px-5 text-accent-foreground hover:bg-accent/90">Start creating <ArrowRight className="size-4" /></Button>
            <Button onClick={onWorkspace} variant="outline" className="h-11 border-foreground/25 bg-background/25 backdrop-blur-xl">Open studio <ArrowUpRight className="size-4" /></Button>
          </div>
          <div className="mt-10 flex gap-5 border-t border-foreground/20 pt-4 font-mono text-[9px] uppercase tracking-wider text-foreground/70"><span>01 / Imagine</span><span>02 / Direct</span><span>03 / Create</span></div>
        </div>
        <span className="absolute bottom-6 right-8 hidden font-mono text-[9px] text-foreground/70 sm:block">OUT THE MUD / IN THE FRAME</span>
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
