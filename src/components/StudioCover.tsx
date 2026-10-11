import { useEffect, useState } from "react";
import { ArrowDown, ArrowRight, Clapperboard, Film, Images, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StudioCover({ children, onWorkspace, onNew, onIdea }: {
  children: React.ReactNode;
  onWorkspace: () => void;
  onNew: () => void;
  onIdea: (idea: string) => void;
}) {
  const [word, setWord] = useState(0);
  const words = ["worlds", "stories", "music videos"];
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = window.setInterval(() => setWord((current) => (current + 1) % words.length), 3600);
    return () => window.clearInterval(interval);
  }, [words.length]);
  const start = () => {
    document.getElementById("creative-start")?.scrollIntoView({ behavior: "smooth", block: "start" });
    document.querySelector<HTMLTextAreaElement>('[aria-label="Creative brief"]')?.focus({ preventScroll: true });
  };
  return (
    <main className="studio-cover flex flex-1 flex-col">
      <section className="cover-intro relative flex flex-col items-center justify-center px-5 text-center">
        <span className="mb-6 flex items-center gap-2 font-mono text-[10px] uppercase text-muted-foreground">
          <Clapperboard className="size-3.5 text-primary" /> REEL / CREATIVE STUDIO
        </span>
        <h1 className="cover-title font-sans font-semibold">
          Generate cinematic<br />
          <span className="cover-word" key={word}>{words[word]}</span> in seconds.
        </h1>
        <p className="mt-6 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Your vision. Your crew. Your next creation.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Button className="gradient-control" onClick={start}>Start creating <ArrowRight /></Button>
          <Button variant="outline" onClick={onWorkspace}>Open studio</Button>
        </div>
        <Button variant="ghost" size="icon" className="absolute bottom-5 rounded-full border border-border text-muted-foreground" onClick={start} aria-label="Go to creative chat" title="Creative chat">
          <ArrowDown />
        </Button>
      </section>
      <section id="creative-start" className="mx-auto w-full max-w-2xl scroll-mt-20 px-5 pb-12 pt-7">
        <div className="mb-7 flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold"><span className="gradient-control grid size-7 place-items-center rounded-full"><Clapperboard className="size-3.5" /></span> Reel Orchestrator</span>
          <Button variant="ghost" size="sm" onClick={onNew}><Plus className="size-3" /> New chat</Button>
        </div>
        <h2 className="mb-6 text-3xl font-semibold leading-tight">What shall we<br /><span className="text-muted-foreground">create together?</span></h2>
        <div className="mb-6 grid grid-cols-2 gap-3">
          <Button variant="secondary" className="h-16 justify-start whitespace-normal px-4 text-left" onClick={() => onIdea("Let's create a cinematic image. ")}><Images className="text-primary" /> Imagine</Button>
          <Button variant="secondary" className="h-16 justify-start whitespace-normal px-4 text-left" onClick={() => onIdea("Let's plan and edit a music video. ")}><Film className="text-primary" /> Make a film</Button>
        </div>
        {children}
      </section>
    </main>
  );
}