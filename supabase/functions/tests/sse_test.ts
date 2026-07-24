import { sseEvent, sseResponse } from "../_shared/sse.ts";

function assert(
  condition: unknown,
  message = "assertion failed",
): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("SSE text and named events follow client contract", () => {
  const decoder = new TextDecoder();
  assert(decoder.decode(sseEvent({ t: "你好" })) === 'data: {"t":"你好"}\n\n');
  assert(
    decoder.decode(sseEvent({ done: true }, "done")) ===
      'event: done\ndata: {"done":true}\n\n',
  );
});

Deno.test("SSE response disables buffering and caching", () => {
  const response = sseResponse(new ReadableStream());
  assert(response.headers.get("content-type")?.startsWith("text/event-stream"));
  assert(response.headers.get("cache-control") === "no-cache, no-transform");
  assert(response.headers.get("x-accel-buffering") === "no");
});
