"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { userOnboarding, users } from "@/db/schema";
import { getActiveTenant } from "@/lib/tenant";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  position: z.string().trim().min(1, "Role is required").max(160),
  weeklyAim: z.string().trim().min(1, "Tell us what you're working toward").max(600),
  goals: z.array(z.string().trim().max(200)).transform((g) => g.filter(Boolean)),
});

export type OnboardingResult = { ok: true } | { ok: false; error: string };

export async function completeOnboarding(
  _prev: OnboardingResult | null,
  formData: FormData,
): Promise<OnboardingResult> {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    position: formData.get("position"),
    weeklyAim: formData.get("weeklyAim"),
    goals: [formData.get("goal1"), formData.get("goal2"), formData.get("goal3")].map(
      (v) => (typeof v === "string" ? v : ""),
    ),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { tenant, user } = await getActiveTenant();
  const db = await getDb();
  const data = parsed.data;
  const now = new Date();

  await db
    .insert(userOnboarding)
    .values({
      tenantId: tenant.id,
      userId: user.id,
      name: data.name,
      position: data.position,
      weeklyAim: data.weeklyAim,
      goals: data.goals,
      completedAt: now,
    })
    .onConflictDoUpdate({
      target: userOnboarding.userId,
      set: {
        name: data.name,
        position: data.position,
        weeklyAim: data.weeklyAim,
        goals: data.goals,
        completedAt: now,
      },
    });

  await db
    .update(users)
    .set({ name: data.name, position: data.position })
    .where(eq(users.id, user.id));

  revalidatePath("/", "layout");
  redirect("/");
}
