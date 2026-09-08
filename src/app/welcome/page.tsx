import { redirect } from "next/navigation";
import { getOnboardingStatus } from "@/lib/onboarding";
import { WelcomeFlow } from "./welcome-flow";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const status = await getOnboardingStatus();
  if (!status.needsOnboarding) redirect("/");
  return <WelcomeFlow initialName={status.userName} />;
}
