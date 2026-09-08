import { PageHeader, EmptyState } from "@/components/ui/primitives";

/** Honest placeholder for a module whose vertical slice is scheduled later (spec §80). */
export function ModuleStub({
  eyebrow,
  title,
  description,
  milestone,
  capabilities,
}: {
  eyebrow: string;
  title: string;
  description: string;
  milestone: string;
  capabilities: string[];
}) {
  return (
    <div>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <EmptyState
        title={`Planned — ${milestone}`}
        body="The data model, navigation and scoring hooks for this module already exist. The interactive slice lands in the milestone above."
      />
      <ul className="mt-5 flex flex-col gap-1.5 text-[13px] text-[var(--muted)]">
        {capabilities.map((c) => (
          <li key={c}>• {c}</li>
        ))}
      </ul>
    </div>
  );
}
