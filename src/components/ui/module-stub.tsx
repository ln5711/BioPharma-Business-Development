import { PageHeader } from "@/components/ui/primitives";

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

      <div className="border-l-2 py-1 pl-5" style={{ borderColor: "var(--hairline)" }}>
        <div className="eyebrow mb-2">Planned — {milestone}</div>
        <p className="meta max-w-[54ch] leading-relaxed">
          The data model, navigation and scoring hooks for this module already
          exist. The interactive slice lands in the milestone above.
        </p>
      </div>

      <ul className="mt-8 flex max-w-[62ch] flex-col gap-2.5">
        {capabilities.map((c) => (
          <li key={c} className="flex gap-3 text-[13px] leading-relaxed">
            <span
              aria-hidden
              className="mt-[7px] h-[4px] w-[4px] shrink-0 rounded-full"
              style={{ background: "var(--accent-2)" }}
            />
            <span className="text-[var(--muted)]">{c}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
