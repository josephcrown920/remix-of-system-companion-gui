# AI Co-Editor Workspace Upgrade

## What will change
- Replace the media bin with a visual library that has **Media** and **Generations** views, larger thumbnails, import controls, and one-click timeline placement.
- Move the co-editor prompt beside the editing panel and add visual image/video model cards plus thumbnail-based effect presets.
- Add named editing sessions so the current timeline, media, messages, and generation settings can be saved and reopened.
- Make every successful NodeCanvas image or video generation automatically appear in the generation gallery and drop onto the next open timeline position.
- Expand the Orchestrator into a visible agent panel that dispatches each brief to Astra, Codex, Fable, and available ModelArk specialists in parallel, then combines their recommendations into one timeline update.

## Experience
- Desktop keeps the preview above the timeline, with the media/gallery workspace on the left and the co-editor/Orchestrator beside the inspector on the right.
- Mobile uses compact tabs and horizontal visual pickers so all tools remain usable without overflow.
- Agent status cards show queued, working, complete, skipped, and failed states.

## Technical details
- Enable Lovable Cloud for persistent sessions and generated-asset records; uploaded browser files remain available in the active session, while generated URLs and project state are saved.
- Extract shared editor/session types and add validated session save/load functions.
- Add a parallel Orchestrator server flow with bounded specialist outputs, safe fallback when ModelArk is not configured, and one final synthesis pass.
- Add focused tests for session serialization, automatic timeline placement, and the required specialist routing set.
- Verify the clean build and exercise session switching, generation-to-timeline, gallery filters, presets, and Orchestrator status on desktop and mobile.