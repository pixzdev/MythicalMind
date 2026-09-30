// Search: conversations by title or message content (used by ⌘K palette)

import { db } from "@/lib/db";
import { handle, ok } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(async () => {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    if (q.length < 1) return ok({ results: [] });

    const conversations = await db.conversation.findMany({
      where: {
        OR: [{ title: { contains: q } }],
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        updatedAt: true,
        archived: true,
        messages: {
          where: { content: { contains: q } },
          select: { content: true, role: true },
          take: 1,
          orderBy: { sortOrder: "desc" },
        },
      },
    });

    const messageMatches = await db.message.findMany({
      where: { content: { contains: q } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        content: true,
        conversation: {
          select: {
            id: true,
            title: true,
            updatedAt: true,
            archived: true,
          },
        },
      },
    });

    const seen = new Set<string>();
    const results: {
      id: string;
      title: string;
      snippet: string | null;
      updatedAt: string;
    }[] = [];

    for (const c of conversations) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      const snippet = c.messages[0]?.content ?? null;
      results.push({
        id: c.id,
        title: c.title,
        snippet: snippet ? snippetText(snippet) : null,
        updatedAt: c.updatedAt.toISOString(),
      });
    }
    for (const m of messageMatches) {
      if (seen.has(m.conversation.id)) continue;
      seen.add(m.conversation.id);
      results.push({
        id: m.conversation.id,
        title: m.conversation.title,
        snippet: snippetText(m.content),
        updatedAt: m.conversation.updatedAt.toISOString(),
      });
    }

    return ok({ results: results.slice(0, 12) });
  });
}

function snippetText(content: string): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length > 110 ? `${flat.slice(0, 110)}…` : flat;
}
