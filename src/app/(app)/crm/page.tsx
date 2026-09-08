import { ModuleStub } from "@/components/ui/module-stub";

export default function CrmPage() {
  return (
    <ModuleStub
      eyebrow="CRM"
      title="CRM sync"
      description="Salesforce stays the system of record; this app is the working interface. Every meaningful BD action carries a CRM sync state, and proposed changes queue for approval (spec §34–§37)."
      milestone="MVP 3"
      capabilities={[
        "Salesforce OAuth, field-mapping UI, read/create/update/upsert with dedupe + conflict handling",
        "CRM Updates queue: approve all / individually / edit / auto-approve selected field types",
        "Dedupe before create — CRM id, email, normalized name + account, professional URL",
        "CSV import/export fallback for API-restricted orgs (spec §37)",
      ]}
    />
  );
}
