import { redirect } from "next/navigation";
import { getOnboardingStatus } from "@/lib/onboarding";
import { TopNav } from "@/components/app-shell/top-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // First-run gate — one animated welcome + onboarding form, then never again.
  const { needsOnboarding } = await getOnboardingStatus();
  if (needsOnboarding) redirect("/welcome");

  return (
    <div className="flex min-h-dvh flex-col">
      <TopNav />
      <main className="flex-1 px-6 py-10 sm:px-10 lg:px-14">
        <div className="mx-auto max-w-[1040px]">{children}</div>
      </main>
    </div>
  );
}
