import { runtimeConfig } from "../_shared/config.ts";
import {
  DiaryProcessingError,
  processDiaryJob,
  recordDiaryJobFailure,
} from "../_shared/diary-processing.ts";
import {
  deleteDiaryJob,
  kickDiaryWorker,
  readDiaryJobs,
} from "../_shared/diary-queue.ts";
import { jsonResponse } from "../_shared/errors.ts";

const MAX_ATTEMPTS = 3;

function safeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  let difference = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405);
  }
  const secret = req.headers.get("x-diary-worker-secret") ?? "";
  if (!secret || !safeEqual(secret, runtimeConfig.diaryWorkerSecret)) {
    return jsonResponse({ error: "UNAUTHORIZED" }, 401);
  }

  const messages = await readDiaryJobs(3);
  let completed = 0;
  let retrying = 0;
  let failed = 0;

  for (const message of messages) {
    try {
      await processDiaryJob(message.message);
      await deleteDiaryJob(message.msg_id);
      completed += 1;
      // Continue the pipeline in a fresh invocation so a long transcription,
      // entry analysis, and three summary layers do not share one time budget.
      kickDiaryWorker();
      // Some downstream summaries use a short debounce to coalesce same-day
      // recordings; schedule one delayed drain as well.
      kickDiaryWorker(6_000);
    } catch (error) {
      const retryable = error instanceof DiaryProcessingError
        ? error.retryable
        : true;
      const terminal = !retryable || message.read_ct >= MAX_ATTEMPTS;
      await recordDiaryJobFailure(message.message, error, terminal);
      if (terminal) {
        await deleteDiaryJob(message.msg_id);
        failed += 1;
      } else {
        retrying += 1;
        kickDiaryWorker(31_000);
      }
      console.error(
        "diary job failed:",
        error instanceof DiaryProcessingError
          ? error.code
          : "DIARY_PROCESSING_FAILED",
      );
    }
  }

  return jsonResponse({
    received: messages.length,
    completed,
    retrying,
    failed,
  });
});
