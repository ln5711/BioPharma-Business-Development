import { getActiveTenant } from "@/lib/tenant";
import { getUserPrefs } from "@/lib/user-prefs";
import { PageHeader } from "@/components/ui/primitives";
import { PasswordForm } from "./password-form";
import {
  addPriority,
  editPriority,
  movePriority,
  removePriority,
  togglePriorityPause,
  updateOrganization,
  updateProfile,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { tenant, user } = await getActiveTenant();
  const prefs = await getUserPrefs(user.id);

  return (
    <div>
      <PageHeader
        eyebrow="You"
        title="Priorities & profile"
        description="Your priorities steer Home recommendations, signal / account / trial ranking, and Ask newwin. Change them any time."
      />

      <section className="mb-9">
        <SectionLabel>Priorities</SectionLabel>
        <div className="mt-3 flex flex-col gap-2">
          {prefs.priorities.length === 0 ? (
            <p className="text-[13px] text-secondary">No priorities set yet.</p>
          ) : (
            prefs.priorities.map((p, i) => (
              <div
                key={p.id}
                className="card flex flex-wrap items-center gap-3 p-3"
                style={{ opacity: p.paused ? 0.55 : 1 }}
              >
                <span className="text-[11px] text-tertiary" style={{ fontFamily: "var(--font-mono)" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {p.recommendedId ? (
                  <span className="flex-1 text-[13.5px] text-primary">
                    {p.text}
                    <span className="ml-2 text-[11px] text-tertiary">recommended</span>
                    {p.paused ? <span className="ml-2 text-[11px] text-warn">paused</span> : null}
                  </span>
                ) : (
                  <form action={editPriority} className="flex flex-1 items-center gap-2">
                    <input type="hidden" name="id" value={p.id} />
                    <input
                      name="text"
                      defaultValue={p.text}
                      maxLength={200}
                      className="input flex-1 !py-1.5 text-[13px]"
                      aria-label="Edit priority"
                    />
                    <span className="text-[11px] text-accent-fg">custom</span>
                    {p.paused ? <span className="text-[11px] text-warn">paused</span> : null}
                    <button className="rounded-[7px] border border-default px-2 py-1 text-[11px] text-secondary">
                      Save
                    </button>
                  </form>
                )}
                <div className="flex items-center gap-1">
                  <MiniForm action={movePriority} fields={{ id: p.id, dir: "up" }} label="↑" />
                  <MiniForm action={movePriority} fields={{ id: p.id, dir: "down" }} label="↓" />
                  <MiniForm
                    action={togglePriorityPause}
                    fields={{ id: p.id, paused: p.paused ? "1" : "0" }}
                    label={p.paused ? "Resume" : "Pause"}
                  />
                  <MiniForm action={removePriority} fields={{ id: p.id }} label="Remove" danger />
                </div>
              </div>
            ))
          )}
        </div>
        <form action={addPriority} className="mt-3 flex gap-2">
          <input
            name="text"
            required
            minLength={2}
            maxLength={200}
            placeholder="Add a priority — e.g. Find prospective partners for liquid biopsy"
            className="input"
          />
          <button type="submit" className={ghostBtn}>
            Add
          </button>
        </form>
        <p className="mt-2 text-[12px] text-tertiary">
          Paused priorities stop influencing recommendations but are kept. Up to 20 priorities.
        </p>
      </section>

      <section className="mb-9">
        <SectionLabel>Profile</SectionLabel>
        <form action={updateProfile} className="mt-3 grid max-w-[520px] gap-3 sm:grid-cols-2">
          <Labeled label="Name">
            <input name="name" defaultValue={user.name} className="input" />
          </Labeled>
          <Labeled label="Role">
            <input
              name="position"
              defaultValue={user.position ?? ""}
              placeholder="Director, Business Development"
              className="input"
            />
          </Labeled>
          <div className="text-[12px] text-tertiary sm:col-span-2">
            Email: {user.email} {user.passwordHash ? "" : "· demo account"}
          </div>
          <div className="sm:col-span-2">
            <button
              className={primaryBtn}
              style={{ background: "var(--accent-btn)", color: "var(--accent-btn-ink)" }}
            >
              Save profile
            </button>
          </div>
        </form>
      </section>

      <section className="mb-9">
        <SectionLabel>Password</SectionLabel>
        <PasswordForm canChange={Boolean(user.passwordHash)} />
      </section>

      <section>
        <SectionLabel>Organization</SectionLabel>
        <form action={updateOrganization} className="mt-3 grid max-w-[520px] gap-3 sm:grid-cols-2">
          <Labeled label="Organization name">
            <input name="name" defaultValue={tenant.name} className="input" />
          </Labeled>
          <Labeled label="Domain">
            <input
              name="domain"
              defaultValue={tenant.domain ?? ""}
              placeholder="predicine.com"
              className="input"
            />
          </Labeled>
          <div className="text-[12px] text-tertiary sm:col-span-2">
            Progressive profile — add products, target accounts, competitors and therapeutic
            areas over time from here as the intelligence layer expands.
          </div>
          <div className="sm:col-span-2">
            <button
              className={primaryBtn}
              style={{ background: "var(--accent-btn)", color: "var(--accent-btn-ink)" }}
            >
              Save organization
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

const ghostBtn =
  "shrink-0 rounded-[10px] border border-default px-3.5 py-2.5 text-[12.5px] text-accent-fg";
const primaryBtn = "rounded-[10px] px-4 py-2.5 text-[12.5px] font-semibold";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-secondary"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {children}
    </h2>
  );
}
function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span
        className="mb-1.5 block text-[10.5px] uppercase tracking-[0.18em] text-tertiary"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
function MiniForm({
  action,
  fields,
  label,
  danger,
}: {
  action: (fd: FormData) => Promise<void>;
  fields: Record<string, string>;
  label: string;
  danger?: boolean;
}) {
  return (
    <form action={action}>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button
        className={`rounded-[7px] border border-default px-2 py-1 text-[11px] ${
          danger ? "text-danger" : "text-secondary"
        }`}
      >
        {label}
      </button>
    </form>
  );
}
