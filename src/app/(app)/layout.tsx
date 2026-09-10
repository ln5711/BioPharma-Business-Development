import { redirect } from "next/navigation";
import { getOnboardingStatus } from "@/lib/onboarding";
import { getActiveTenant } from "@/lib/tenant";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { BottomNav } from "@/components/app-shell/bottom-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const status = await getOnboardingStatus();
  // Signed out, or session valid but onboarding not finished → public welcome.
  if (!status.authenticated || status.needsOnboarding) redirect("/welcome");
  const { user } = await getActiveTenant();

  return (
    <div className="pulsar-shell flex h-dvh flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1">
        <Sidebar userName={user?.name ?? "newwin"} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar userName={user?.name ?? "newwin"} authenticated={status.authenticated} />
          <main className="min-h-0 flex-1 overflow-y-auto px-5 py-[30px] pb-12 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-[1240px]">{children}</div>
          </main>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
