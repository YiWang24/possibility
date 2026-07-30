"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LabView } from "@/features/lab/LabView";

function LabPageInner() {
  const params = useSearchParams();
  const question = params.get("question") ?? undefined;
  return <LabView initialQuestion={question} />;
}

export default function LabPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh screen-bg" />}>
      <LabPageInner />
    </Suspense>
  );
}
