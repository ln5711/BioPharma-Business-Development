import { ModuleStub } from "@/components/ui/module-stub";

export default function MeetingsPage() {
  return (
    <ModuleStub
      eyebrow="Meetings"
      title="Meetings"
      description="Relationship timeline of meetings with one-click PREPARE ME briefs — company overview, attendees, relevant assets, what changed since last contact, pitch angle, questions, risks, next-step objective (spec §25 / §102)."
      milestone="MVP 5"
      capabilities={[
        "Calendar capture (Google / Microsoft) so interactions are not logged by hand (spec §40)",
        "PREPARE ME brief generated from structured data + provenance",
        "Post-meeting: AI-drafted notes and queued CRM updates",
      ]}
    />
  );
}
