import {
  errorResponse,
  HttpError,
  requestIdOf,
  transactionOf,
} from "../_shared/errors.ts";

function assert(
  condition: unknown,
  message = "assertion failed",
): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("transactionOf extracts the Edge Function name", () => {
  assert(
    transactionOf(
      new Request("https://example.supabase.co/functions/v1/chat"),
    ) ===
      "chat",
  );
  assert(
    transactionOf(
      new Request("http://127.0.0.1:54321/functions/v1/analyze-diary"),
    ) === "analyze-diary",
  );
  assert(transactionOf(new Request("http://localhost/match")) === "match");
  assert(transactionOf() === "edge-function");
});

Deno.test("requestIdOf reuses safe IDs and rejects log injection", () => {
  const safe = new Request("http://localhost/chat", {
    headers: { "X-Request-ID": "ios:request-123" },
  });
  assert(requestIdOf(safe) === "ios:request-123");

  const unsafe = new Request("http://localhost/chat", {
    headers: { "X-Request-ID": "bad request id" },
  });
  const generated = requestIdOf(unsafe);
  assert(generated !== "bad request id");
  assert(/^[0-9a-f-]{36}$/.test(generated));
});

Deno.test("errorResponse correlates expected errors without exposing internals", async () => {
  const req = new Request("http://localhost/functions/v1/match", {
    headers: { "X-Request-ID": "request-expected" },
  });
  const response = errorResponse(
    new HttpError(400, "INVALID_INPUT", "参数错误"),
    req,
  );
  assert(response.status === 400);
  assert(response.headers.get("X-Request-ID") === "request-expected");
  const body = await response.json() as {
    request_id?: string;
    error: { code?: string };
  };
  assert(body.request_id === "request-expected");
  assert(body.error.code === "INVALID_INPUT");
});
