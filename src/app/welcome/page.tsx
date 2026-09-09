import { redirect } from "next/navigation";
import { getOnboardingStatus } from "@/lib/onboarding";
import { WelcomeFlow } from "./welcome-flow";
import { CompleteOnboarding } from "./complete-onboarding";

export const dynamic = "force-dynamic";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ intro?: string }>;
}) {
  const status = await getOnboardingStatus();

  // Already signed in and fully onboarded → straight to Home.
  if (status.authenticated && !status.needsOnboarding) redirect("/");

  // Signed in but onboarding unfinished → short completion form, NO re-register.
  if (status.authenticated && status.needsOnboarding) {
    return <CompleteOnboarding userName={status.userName ?? "there"} />;
  }

  // Signed out → public welcome + animated intro + signup / sign-in.
  const sp = await searchParams;
  return <WelcomeFlow replayIntro={sp?.intro === "1"} />;
}
