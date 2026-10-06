import { MilestoneEditor } from "../editor";

export const dynamic = "force-dynamic";

export default async function NewMilestone({ params }: PageProps<"/projects/[id]/milestones/new">) {
  const { id } = await params;
  return MilestoneEditor({ projectId: id });
}
