import { useEffect, useState } from "react";
import { BookOpen, Check } from "lucide-react";
import { readCreativeContext, saveCreativeContext } from "@/lib/creative-context";

export function CreativeContext() {
  const [context, setContext] = useState("");
  useEffect(() => setContext(readCreativeContext()), []);
  return (
    <details className="creative-context border-y border-border py-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold">
        <BookOpen className="size-4 text-accent" /> Creative context
        <span className="ml-auto flex items-center gap-1 font-mono text-[9px] text-muted-foreground">{context.trim() ? <><Check className="size-3" /> ACTIVE</> : "ADD CONTEXT"}</span>
      </summary>
      <textarea aria-label="Creative context" maxLength={6000} value={context} onChange={(e) => { setContext(e.target.value); saveCreativeContext(e.target.value); }} placeholder="Artist or brand, audience, visual identity, mood, details to preserve…" className="mt-3 min-h-28 w-full resize-y rounded-md border border-input bg-background p-3 text-xs leading-relaxed outline-none focus:border-primary" />
    </details>
  );
}