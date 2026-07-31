import { runtimeConfig } from "./config.ts";
import { HttpError } from "./errors.ts";
import { serviceClient } from "./service.ts";

export type DiaryTaskType =
  | "transcribe_entry"
  | "analyze_entry"
  | "generate_day_summary"
  | "generate_month_summary"
  | "generate_year_summary";

export type DiaryJob = {
  job_key: string;
  task_type: DiaryTaskType;
  user_id: string;
  entry_id: string | null;
  period_start: string | null;
};

export type DiaryQueueMessage = {
  msg_id: number;
  read_ct: number;
  enqueued_at: string;
  vt: string;
  message: DiaryJob;
};

export async function enqueueDiaryJob(
  job: DiaryJob,
  delaySeconds = 0,
): Promise<void> {
  const { error } = await serviceClient().rpc("enqueue_diary_job", {
    p_job_key: job.job_key,
    p_task_type: job.task_type,
    p_user_id: job.user_id,
    p_entry_id: job.entry_id,
    p_period_start: job.period_start,
    p_delay_seconds: delaySeconds,
  });
  if (error) {
    console.error("enqueue diary job failed:", error.code ?? "DATABASE_ERROR");
    throw new HttpError(500, "QUEUE_ERROR", "暂时无法安排日记处理任务。");
  }
}

export async function readDiaryJobs(
  quantity = 1,
): Promise<DiaryQueueMessage[]> {
  const { data, error } = await serviceClient().rpc("read_diary_jobs", {
    p_visibility_seconds: 30,
    p_quantity: quantity,
  });
  if (error) throw new Error("DIARY_QUEUE_READ_FAILED");
  return (data ?? []) as unknown as DiaryQueueMessage[];
}

export async function deleteDiaryJob(messageId: number): Promise<void> {
  const { data, error } = await serviceClient().rpc("delete_diary_job", {
    p_message_id: messageId,
  });
  if (error || data !== true) throw new Error("DIARY_QUEUE_DELETE_FAILED");
}

export function entryJobKey(
  task: "transcribe_entry" | "analyze_entry",
  entryId: string,
  contentVersion: number,
): string {
  return `${task}:${entryId}:v${contentVersion}`;
}

export function summaryJobKey(
  task:
    | "generate_day_summary"
    | "generate_month_summary"
    | "generate_year_summary",
  userId: string,
  periodStart: string,
  fingerprint = "latest",
): string {
  return `${task}:${userId}:${periodStart}:${fingerprint}`;
}

type EdgeRuntimeWithWaitUntil = {
  waitUntil?: (promise: Promise<unknown>) => void;
};

export function kickDiaryWorker(delayMs = 0): void {
  const request = new Promise<void>((resolve) => {
    setTimeout(resolve, Math.max(0, delayMs));
  }).then(() =>
    fetch(
      `${runtimeConfig.supabaseUrl}/functions/v1/diary-worker`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-diary-worker-secret": runtimeConfig.diaryWorkerSecret,
        },
        body: JSON.stringify({ source: delayMs > 0 ? "retry" : "enqueue" }),
      },
    )
  ).then((response) => {
    if (!response.ok) throw new Error(`DIARY_WORKER_HTTP_${response.status}`);
  }).catch((error) => {
    console.error(
      "kick diary worker failed:",
      error instanceof Error ? error.message : "UNKNOWN",
    );
  });

  const edgeRuntime = (globalThis as typeof globalThis & {
    EdgeRuntime?: EdgeRuntimeWithWaitUntil;
  }).EdgeRuntime;
  if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(request);
}
