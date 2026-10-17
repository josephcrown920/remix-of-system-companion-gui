import assert from "node:assert/strict";
import { test } from "node:test";
import { parseComfyWorkflow, missingComfyNodes, prepareComfyWorkflow, normalizeComfyUrl, stylePrompt } from "./creative-tools";
import workflow from "../data/krea-style-workflow.json";
test("uploaded Krea graph preserves both style-reference inputs", () => {
  const graph = parseComfyWorkflow(workflow);
  assert.deepEqual(graph["7"]?.inputs["style_reference"], ["8", 0]);
  assert.deepEqual(graph["1"]?.inputs["model.style_reference"], ["7", 0]);
});
test("missing Krea custom nodes block execution rather than substitute models", () => {
  assert.deepEqual(missingComfyNodes(parseComfyWorkflow(workflow), { LoadImage: {}, SaveImage: {} }), ["Krea2ImageNode", "Krea2StyleReferenceNode"]);
});
test("reference uploads are mapped without mutating the imported graph", () => {
  const graph = parseComfyWorkflow(workflow);
  const copy = prepareComfyWorkflow(graph, "new shot", { "11": "uploaded.png" });
  assert.equal(copy["11"]?.inputs["image"], "uploaded.png");
  assert.equal(graph["11"]?.inputs["image"], "krea_style_reference_image1.png");
  assert.equal(copy["1"]?.inputs["prompt"], "new shot");
});
test("server addresses never accept embedded credentials", () => {
  assert.throws(() => normalizeComfyUrl("https://secret@example.com"));
  assert.equal(normalizeComfyUrl("https://example.com/"), "https://example.com");
});
test("no selected moodboard leaves the prompt unchanged", () => { assert.equal(stylePrompt("a portrait", null), "a portrait"); });
test("ComfyUI imports reject array inputs and canvas exports", () => {
  assert.throws(() => parseComfyWorkflow({ nodes: [], links: [] }));
  assert.throws(() => parseComfyWorkflow({ "1": { class_type: "LoadImage", inputs: [] } }));
});
test("ComfyUI addresses reject unsafe schemes and credential query strings", () => {
  assert.throws(() => normalizeComfyUrl("javascript:alert(1)"));
  assert.throws(() => normalizeComfyUrl("https://example.com?token=secret"));
});
test("selected style stays subordinate to current instructions", () => {
  const prompt = stylePrompt("Keep the outfit red", { profile: "Vintage Pop", keywords: ["halftone"] }, 0.65);
  assert.ok(prompt.startsWith("Keep the outfit red"));
  assert.ok(prompt.includes("current instructions take priority"));
  assert.ok(prompt.includes("strength 65%"));
});
