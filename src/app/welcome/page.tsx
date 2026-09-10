import { redirect } from "next/navigation";
import { getOnboardingStatus } from "@/lib/onboarding";
import { WelcomeFlow } from "./welcome-flow";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const status = await getOnboardingStatus();
  // A signed-in, already-onboarded user goes straight home.
  if (status.authenticated && !status.needsOnboarding) redirect("/");
  return <WelcomeFlow />;
}
