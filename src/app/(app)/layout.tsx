import { redirect } from "next/navigation";
import { getOnboardingStatus } from "@/lib/onboarding";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // First-run gate — one animated welcome + onboarding form, then never again.
  const { needsOnboarding } = await getOnboardingStatus();
  if (needsOnboarding) redirect("/welcome");

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="min-h-0 flex-1 overflow-y-auto px-8 py-10 sm:px-12 lg:px-16">
          <div className="mx-auto max-w-[980px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
