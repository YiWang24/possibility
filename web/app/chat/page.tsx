import { Suspense } from "react";
import { ChatView } from "@/features/chat/ChatView";

export const metadata = {
  title: "探索对话 · 万花筒",
};

/** 单值化 searchParams */
function pick(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const topic = pick(params.topic);
  const question = pick(params.q);
  const id = pick(params.id);

  return (
    <Suspense fallback={<div className="min-h-dvh screen-bg" />}>
      <ChatView topic={topic} question={question} id={id} entryPoint="home" />
    </Suspense>
  );
}
