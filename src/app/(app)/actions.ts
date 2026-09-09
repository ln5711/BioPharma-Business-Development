"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { signOut } from "@/lib/auth";

export async function signOutAction() {
  await signOut();
  revalidatePath("/", "layout");
  redirect("/welcome");
}
