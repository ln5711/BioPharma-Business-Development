import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { askConversations, askMessages } from "@/db/schema";
import type { AskResponse } from "./types";

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  payload?: Record<string, unknown> | null;
  createdAt: string;
}

/** Verify the conversation belongs to this user in this workspace. */
async function ownConversation(
  conversationId: string,
  tenantId: string,
  userId: string,
): Promise<boolean> {
  const db = await getDb();
  const [row] = await db
    .select({ id: askConversations.id })
    .from(askConversations)
    .where(
      and(
        eq(askConversations.id, conversationId),
        eq(askConversations.tenantId, tenantId),
        eq(askConversations.userId, userId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function loadConversation(
  conversationId: string,
  tenantId: string,
  userId: string,
): Promise<ConversationTurn[] | null> {
  if (!(await ownConversation(conversationId, tenantId, userId))) return null;
  const db = await getDb();
  const rows = await db
    .select()
    .from(askMessages)
    .where(eq(askMessages.conversationId, conversationId))
    .orderBy(asc(askMessages.createdAt))
    .limit(40);
  return rows.map((r) => ({
    role: r.role === "assistant" ? "assistant" : "user",
    content: r.content,
    payload: r.payload,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function listConversations(tenantId: string, userId: string) {
  const db = await getDb();
  return db
    .select({
      id: askConversations.id,
      title: askConversations.title,
      updatedAt: askConversations.updatedAt,
    })
    .from(askConversations)
    .where(and(eq(askConversations.tenantId, tenantId), eq(askConversations.userId, userId)))
    .orderBy(desc(askConversations.updatedAt))
    .limit(30);
}

/**
 * Append a user question + its assistant answer to a conversation, creating the
 * conversation if `conversationId` is absent or not owned by the caller. Returns
 * the conversation id actually used.
 */
export async function recordTurn(args: {
  tenantId: string;
  userId: string;
  conversationId?: string | null;
  question: string;
  response: AskResponse;
}): Promise<string> {
  const db = await getDb();
  let convId = args.conversationId ?? null;

  if (!convId || !(await ownConversation(convId, args.tenantId, args.userId))) {
    const [conv] = await db
      .insert(askConversations)
      .values({
        tenantId: args.tenantId,
        userId: args.userId,
        title: args.question.slice(0, 80),
      })
      .returning({ id: askConversations.id });
    convId = conv.id;
  } else {
    await db
      .update(askConversations)
      .set({ updatedAt: new Date() })
      .where(eq(askConversations.id, convId));
  }

  await db.insert(askMessages).values([
    { conversationId: convId, role: "user", content: args.question, payload: null },
    {
      conversationId: convId,
      role: "assistant",
      content: args.response.answer,
      payload: args.response as unknown as Record<string, unknown>,
    },
  ]);
  return convId;
}
