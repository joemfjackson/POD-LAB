import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/server/context";
import { OnboardingForm } from "./form";

export const metadata: Metadata = { title: "Create workspace" };

export default async function OnboardingPage() {
  const session = await getUser();
  if (!session) redirect("/login?next=/onboarding");
  const members = await session.db.from("workspace_members").select("workspace_id").eq("user_id", session.user.id);
  const hasWorkspace = (members.data?.length ?? 0) > 0;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-lg border border-line bg-surface p-6">
        <p className="font-mono text-xs text-accent">POD LAB · SETUP</p>
        <h1 className="mt-1 text-lg font-semibold">{hasWorkspace ? "Create another workspace" : "Create your workspace"}</h1>
        <p className="mt-1 text-sm text-muted">
          A workspace holds brands, research, agents and settings. You can invite teammates later (owner, admin, editor, viewer).
        </p>
        <div className="mt-5">
          <OnboardingForm />
        </div>
      </div>
    </main>
  );
}
