import { ModuleStub } from "@/components/ui/module-stub";

export default function CampaignsPage() {
  return (
    <ModuleStub
      eyebrow="Campaigns"
      title="Campaigns"
      description="Themed programs (KRAS, FGFR, MRD, ASCO 2027, Phase III) that define target pathways, personas, scoring thresholds and follow-up sequences, then add/remove prospects dynamically as they match (spec §41)."
      milestone="MVP 4"
      capabilities={[
        "Criteria-driven membership: pathways, indications, trial stages, personas, score threshold",
        "Event-driven sequencing over fixed drip cadence (spec §31)",
        "Auto-stop on reply / meeting booked / job change / trial termination",
      ]}
    />
  );
}
