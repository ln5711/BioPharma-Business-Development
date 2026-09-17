import "dotenv/config";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "@/db";
import { trials } from "@/db/schema";
import { explainTrialFlags } from "@/lib/oncology/flag-evidence";

async function main() {
  const db = await getDb();
  const [t] = await db.select().from(trials).where(eq(trials.nctId, process.argv[2] ?? "NCT07621718")).limit(1);
  if (!t) return console.log("not found");
  for (const f of explainTrialFlags(t as never)) {
    console.log(`${f.flagged ? "●" : "○"} ${f.label}  evidenced=${f.evidenced} derivation=${f.derivation}`);
    if (f.flagged) {
      console.log(`   source: ${f.sourceField ?? "—"}`);
      console.log(`   excerpt: ${f.excerpt ? `"${f.excerpt.slice(0, 180)}"` : "(none — shown as inference, not a pill)"}`);
    }
  }
}
main().then(closeDb).catch(async (e) => { console.error(e); await closeDb(); process.exit(1); });
