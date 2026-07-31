import { notFound } from "next/navigation";
import { AssessmentView } from "@/features/studio/assessment/AssessmentView";
import { ASSESSMENT_KINDS, isAssessmentKind } from "@/features/studio/assessment/data";

export function generateStaticParams() {
  return ASSESSMENT_KINDS.map((kind) => ({ kind }));
}

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind } = await params;
  if (!isAssessmentKind(kind)) notFound();
  return <AssessmentView kind={kind} />;
}
