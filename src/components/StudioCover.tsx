import {
  ArrowRight,
  ArrowUpRight,
  Clapperboard,
  Film,
  MoveUpRight,
  Plus,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import scene1 from "@/assets/scene1.jpg";
import scene2 from "@/assets/scene2.jpg";
import scene3 from "@/assets/scene3.jpg";

type StudioMode = "edit" | "canvas" | "layers";

const features = [
  {
    number: "01",
    eyebrow: "GENERATE · DIRECT",
    title: "Find the frame",
    copy: "Start with a brief. Your co-editor turns the idea into a visual direction you can shape.",
    image: scene2,
    alt: "A cinematic portrait in a neon-lit city, used as a visual direction reference",
    prompt: "A quiet moment, just before the city wakes.",
    action: "Open director",
    mode: "edit" as StudioMode,
    className: "feature-card--portrait",
  },
  {
    number: "02",
    eyebrow: "CONNECT · CREATE",
    title: "Build a visual flow",
    copy: "Link a prompt, image and motion into one editable generation chain.",
    image: scene3,
    alt: "A wide cinematic city frame with warm sunrise light",
    prompt: "PROMPT  →  FRAME  →  MOTION",
    action: "Open canvas",
    mode: "canvas" as StudioMode,
    className: "feature-card--flow",
  },
  {
    number: "03",
    eyebrow: "REFINE · PRESERVE",
    title: "Edit by layer",
    copy: "Change one part of a shot while keeping the rest of the scene consistent.",
    image: scene1,
    alt: "A rain-soaked neon street, framed as a cinematic source plate",
    prompt: "BACKGROUND  ·  LIGHT  ·  TALENT",
    action: "Open layers",
    mode: "layers" as StudioMode,
    className: "feature-card--layers",
  },
];

export function StudioCover({
  children,
  onWorkspace,
  onNew,
  onIdea,
  onMode,
}: {
  children: React.ReactNode;
  onWorkspace: () => void;
  onNew: () => void;
  onIdea: (idea: string) => void;
  onMode: (mode: StudioMode) => void;
}) {
  const start = () => {
    document.getElementById("creative-start")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
    document
      .querySelector<HTMLTextAreaElement>('[aria-label="Creative brief"]')
      ?.focus({ preventScroll: true });
  };

  return (
    <main className="studio-cover flex flex-1 flex-col">
      <section
        className="cover-scene relative isolate overflow-hidden"
        aria-labelledby="cover-title"
      >
        <img
          src={scene1}
          alt=""
          fetchPriority="high"
          className="cover-photo absolute inset-0 h-full w-full object-cover"
        />
        <div className="cover-shade absolute inset-0" />
        <div className="cover-copy relative z-10 mx-auto flex h-full w-full max-w-[1440px] flex-col justify-between px-5 sm:px-10 lg:px-16">
          <div className="cover-heading max-w-2xl">
            <p className="mb-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/75">
              <Clapperboard className="size-4 text-accent" />
              AURORA PERFORMANCE STUDIO <span className="text-foreground/35">/</span> REEL
            </p>
            <h1
              id="cover-title"
              className="font-display text-5xl font-bold leading-[0.98] tracking-[-0.055em] sm:text-7xl lg:text-[5.5rem]"
            >
              Make the frame.
              <br />
              <span className="cover-word">Move the story.</span>
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-foreground/75 sm:text-base">
              Direct with a creative co-editor, build the shot, then cut the whole thing together.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button
                onClick={start}
                className="h-11 bg-accent px-5 font-semibold text-accent-foreground hover:bg-accent/90"
              >
                Start with an idea <ArrowRight className="size-4" />
              </Button>
              <Button
                onClick={onWorkspace}
                variant="outline"
                className="h-11 border-foreground/25 bg-background/25 backdrop-blur-xl hover:bg-background/50"
              >
                Open editor <ArrowUpRight className="size-4" />
              </Button>
            </div>
          </div>

          <div
            className="cover-filmstrip relative z-10 mb-5 hidden items-end gap-5 self-end md:flex"
            role="img"
            aria-label="A sample film sequence"
          >
            <div className="filmstrip-copy pb-2">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-foreground/60">
                A sequence, not a prompt
              </p>
              <p className="mt-1 font-display text-sm font-semibold">
                Three frames. One direction.
              </p>
            </div>
            <div className="filmstrip-frames flex gap-1.5">
              {[scene1, scene2, scene3].map((frame, index) => (
                <div className="filmstrip-frame" key={frame}>
                  <img src={frame} alt="" loading="lazy" />
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </div>
              ))}
            </div>
            <div className="filmstrip-timeline" aria-hidden="true">
              <div className="filmstrip-track">
                <i />
                <i />
                <i />
              </div>
              <div className="filmstrip-track filmstrip-track--audio">
                <i />
              </div>
              <span className="filmstrip-playhead" />
            </div>
            <span className="filmstrip-time font-mono text-[9px] text-foreground/65">00:08</span>
          </div>
        </div>
        <span className="cover-index absolute right-6 top-6 z-10 hidden font-mono text-[9px] tracking-[0.16em] text-foreground/65 sm:block">
          STUDIO 01 <span>—</span> REAL-TIME CREATIVE
        </span>
      </section>

      <section
        className="workflow-showcase mx-auto w-full max-w-[1440px] px-5 py-12 sm:px-10 sm:py-16 lg:px-16"
        aria-labelledby="workflow-title"
      >
        <div className="workflow-heading mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
          <div>
            <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-primary">
              One creative workspace
            </p>
            <h2
              id="workflow-title"
              className="font-display text-2xl font-bold tracking-tight sm:text-3xl"
            >
              From first thought to final cut.
            </h2>
          </div>
          <p className="max-w-xs text-xs leading-5 text-muted-foreground">
            The tools are connected, so a good idea can keep moving.
          </p>
        </div>
        <div className="feature-grid">
          {features.map((feature) => {
            return (
              <article className={`feature-card ${feature.className}`} key={feature.number}>
                <div className="feature-media">
                  <img src={feature.image} alt={feature.alt} loading="lazy" />
                  <span className="feature-media-vignette" />
                  <span className="feature-number">
                    {feature.number} <span>/ 03</span>
                  </span>
                  {feature.mode === "edit" ? (
                    <div className="feature-prompt" aria-label="Example creative direction">
                      <span className="feature-prompt-mark">
                        <WandSparkles className="size-3.5" />
                      </span>
                      <span>{feature.prompt}</span>
                    </div>
                  ) : feature.mode === "canvas" ? (
                    <div
                      className="flow-overlay"
                      role="img"
                      aria-label="The visual generation workflow: prompt, frame, then motion"
                    >
                      <span className="flow-node">
                        <i className="flow-dot" />
                        Prompt
                      </span>
                      <span className="flow-connector" />
                      <span className="flow-node">
                        <i className="flow-dot flow-dot--image" />
                        Frame
                      </span>
                      <span className="flow-connector" />
                      <span className="flow-node">
                        <Film className="size-3.5 text-accent" />
                        Motion
                      </span>
                    </div>
                  ) : (
                    <div
                      className="layer-overlay"
                      role="img"
                      aria-label="Three independently editable image layers: background, light and talent"
                    >
                      {["Background", "Light", "Talent"].map((layer, index) => (
                        <span
                          className={index === 1 ? "layer-chip layer-chip--active" : "layer-chip"}
                          key={layer}
                        >
                          <i />
                          {layer}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="feature-copy">
                  <p className="feature-eyebrow">{feature.eyebrow}</p>
                  <h3>{feature.title}</h3>
                  <p className="feature-description">{feature.copy}</p>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      feature.mode === "edit" ? onIdea(feature.prompt) : onMode(feature.mode)
                    }
                    className="feature-action"
                  >
                    {feature.action} <MoveUpRight className="size-3.5" />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section
        id="creative-start"
        className="director-desk mx-auto grid w-full max-w-[1440px] scroll-mt-16 gap-8 px-5 pb-12 sm:px-10 sm:pb-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12 lg:px-16"
      >
        <div className="director-panel min-w-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.18em] text-primary">
                Your next scene starts here
              </p>
              <h2 className="font-display text-2xl font-bold tracking-tight">
                The director’s desk
              </h2>
            </div>
            <Button variant="ghost" size="sm" onClick={onNew} className="text-muted-foreground">
              <Plus className="size-3.5" /> New chat
            </Button>
          </div>
          {children}
        </div>
        <aside className="inspiration-panel min-w-0">
          <div className="mb-4 flex items-end justify-between gap-3 border-b border-border pb-3">
            <div>
              <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                Start from a visual
              </p>
              <h2 className="font-display text-lg font-semibold">Pick a direction</h2>
            </div>
            <span className="font-mono text-[9px] text-muted-foreground">SELECT → BRIEF</span>
          </div>
          <div className="inspiration-grid">
            {[
              {
                image: scene2,
                label: "Neon after dark",
                type: "PORTRAIT / CINEMA",
                idea: "Create a cinematic portrait in a neon-lit city at night. Keep the camera close, use moody teal shadows and warm practical lights, and let the moment feel quiet and human.",
              },
              {
                image: scene3,
                label: "First light",
                type: "CITY / ATMOSPHERE",
                idea: "Create a wide city sequence at first light: low sun, soft mist between the buildings, warm reflections on the river, and a slow, graceful aerial camera move.",
              },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  onIdea(item.idea);
                  start();
                }}
                className="inspiration-card group"
              >
                <img src={item.image} alt={`${item.label} visual direction`} loading="lazy" />
                <span className="inspiration-shade" />
                <span className="inspiration-content">
                  <span className="font-mono text-[8px] tracking-[0.15em] text-foreground/70">
                    {item.type}
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-2 text-sm font-semibold">
                    {item.label}
                    <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Film className="size-3.5 text-accent" /> Choose a frame and it becomes your starting
            brief.
          </p>
        </aside>
      </section>
    </main>
  );
}
