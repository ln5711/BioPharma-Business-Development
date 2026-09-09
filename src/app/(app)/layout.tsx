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
    <div className="app-shell">
      <div className="app-panel">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="min-h-0 flex-1 overflow-y-auto px-[26px] py-[30px] pb-11">
            <div className="mx-auto w-full max-w-[1180px]">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
