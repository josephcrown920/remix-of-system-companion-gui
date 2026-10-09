<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the editor as a single responsive workspace with reusable semantic glass utilities; this preserves consistent Mac-style depth across editor and canvas modes.
- Keep fresh-session startup separate from saved-session restoration and initialize it without assets or clips; the creative chat must precede editing without overwriting saved work.
- Reuse CreativeChat and CrewBoard between the opening screen and workspace; show submitted crew work as awaiting its report rather than inventing per-agent milestones.
- Keep editor-session serialization in the shared editor-state module; browser uploads use temporary URLs and must never be persisted as session data.
- Keep agent replies on the existing TanStack API route and forward streamed provider output as SSE; this preserves the HTTP boundary while enabling live updates and cancellation.
