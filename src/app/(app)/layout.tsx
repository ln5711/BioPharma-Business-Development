import { redirect } from "next/navigation";
import { getOnboardingStatus } from "@/lib/onboarding";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { BottomNav } from "@/components/app-shell/bottom-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // First-run gate — the pulsar sign-in, then never again.
  const { needsOnboarding } = await getOnboardingStatus();
  if (needsOnboarding) redirect("/welcome");

  return (
    <div className="pulsar-shell flex h-dvh flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="min-h-0 flex-1 overflow-y-auto px-5 py-[30px] pb-12 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-[1240px]">{children}</div>
          </main>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
