import { ModuleStub } from "@/components/ui/module-stub";

export default function OutreachPage() {
  return (
    <ModuleStub
      eyebrow="Outreach"
      title="Outreach composer"
      description="Evidence-based drafting that connects person + role + asset + recent development + business need + our capability + one low-friction CTA (spec §26–§29). Human approval required before any first-touch send (spec §32)."
      milestone="MVP 1 (draft) → MVP 4 (send + sequences)"
      capabilities={[
        "OutreachContext object assembled before generation — the model never writes without context",
        "Personalization levels 0–5 with the evidence used shown alongside the draft",
        "Bad-outreach detector: specificity, credibility, brevity, single CTA, scientific correctness, spam risk",
        "Approval screen: TO · WHY THIS PERSON · WHY NOW · SOURCES USED · MESSAGE",
        "Collision check before send — colleague activity, active opportunity, opt-out (spec §39 / §73)",
      ]}
    />
  );
}
