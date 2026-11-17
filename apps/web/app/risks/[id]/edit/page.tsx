import { RiskEditor } from "../../editor";
export const dynamic = "force-dynamic";
export default async function EditRisk({ params }: PageProps<"/risks/[id]/edit">) {
  const { id } = await params;
  return RiskEditor({ id });
}
