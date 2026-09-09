import "server-only";
import type { getDb } from "@/db";
import { workspaceItems, type WorkspaceTemplate } from "@/db/schema";

type Db = Awaited<ReturnType<typeof getDb>>;

export const TEMPLATE_META: Record<
  WorkspaceTemplate,
  { label: string; sections: string[] }
> = {
  presentation: {
    label: "Presentation",
    sections: ["todo", "signals", "assets", "trials", "evidence", "people", "output", "notes"],
  },
  meeting_prep: {
    label: "Meeting prep",
    sections: ["todo", "people", "signals", "evidence", "notes"],
  },
  account_research: {
    label: "Account research",
    sections: ["todo", "signals", "assets", "trials", "people", "notes"],
  },
  outreach: {
    label: "Outreach / prospecting",
    sections: ["todo", "signals", "people", "evidence", "output"],
  },
  conference_prep: {
    label: "Conference prep",
    sections: ["todo", "people", "signals", "notes"],
  },
  opportunity_analysis: {
    label: "Opportunity analysis",
    sections: ["todo", "signals", "trials", "evidence", "notes"],
  },
  custom: { label: "Custom", sections: ["todo", "notes"] },
};

const RECOMMENDED_TODOS: Record<WorkspaceTemplate, string[]> = {
  presentation: [
    "Review recent changes in the account's oncology pipeline",
    "Confirm active assets and clinical stage",
    "Find the strongest supporting internal evidence",
    "Validate the key metrics you will present",
    "Identify meeting participants and their roles",
    "Draft talking points and the desired next step",
  ],
  meeting_prep: [
    "Confirm attendees and their functions",
    "Summarise what changed since the last interaction",
    "Pull two or three relevant signals or publications",
    "Decide the objective and the single next step",
  ],
  account_research: [
    "Map the account's assets, targets and indications",
    "Review trial activity and recent amendments",
    "Identify translational / precision medicine stakeholders",
    "Check outreach history and relationship state",
  ],
  outreach: [
    "Confirm the triggering signal and why now",
    "Identify the right person for this specific signal",
    "Assemble supporting evidence",
    "Draft the message with one low-friction CTA",
  ],
  conference_prep: [
    "List monitored accounts presenting",
    "Flag presenters you have no coverage on",
    "Draft meeting-request messages",
  ],
  opportunity_analysis: [
    "State the commercial use case and timing window",
    "Check for an announced competing partner",
    "Quantify the opportunity and confidence separately",
  ],
  custom: ["Define the objective", "List what you need to finish it"],
};

/** Seed a new workspace with its template sections + newwin-recommended to-dos. */
export async function seedWorkspace(
  db: Db,
  workspaceId: string,
  template: WorkspaceTemplate,
  objective: string,
): Promise<void> {
  const todos = RECOMMENDED_TODOS[template] ?? RECOMMENDED_TODOS.custom;
  const rows = [
    {
      workspaceId,
      section: "notes",
      title: "Objective",
      body: objective,
      generated: true,
      sortIndex: 0,
    },
    ...todos.map((t, i) => ({
      workspaceId,
      section: "todo",
      title: t,
      generated: true,
      sortIndex: i,
    })),
  ];
  await db.insert(workspaceItems).values(rows);
}
