import { ModuleStub } from "@/components/ui/module-stub";

export default function PeoplePage() {
  return (
    <ModuleStub
      eyebrow="People"
      title="People"
      description="Contacts with a person-relevance score and mandatory contact-asset evidence — never an association inferred from company employment alone (spec §18 / §19)."
      milestone="MVP 1–2"
      capabilities={[
        "Persona ranking per opportunity (Translational Medicine, Precision Medicine, Biomarker Development, Clinical Development, BD)",
        "Person relevance score (functional relevance, asset association, seniority, publication evidence, contact recency)",
        "Evidence drawer: every asset association carries a source and confidence",
        "Professional data only — no sensitive personal attributes (spec §66)",
      ]}
    />
  );
}
