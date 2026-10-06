import { MilestoneEditor } from "../../editor";

export const dynamic = "force-dynamic";

export default async function EditMilestone({ params }: PageProps<"/projects/[id]/milestones/[milestoneId]/edit">) {
  const { id, milestoneId } = await params;
  return MilestoneEditor({ projectId: id, milestoneId });
}
