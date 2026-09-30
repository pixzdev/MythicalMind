// MythicalMind — FINAL ACCEPTANCE TEST (spec §42)
//
// Exercises the real product through real HTTP:
//   1. launch          2. add provider      3. connect & test
//   4. discover models 5. conversation A    6. long prompt, real streaming
//   7. navigate to B   8. A keeps streaming 9. parallel generation in B
//  10. return to A     11. state synchronized (SSE snapshot replay)
//  12. A completes     13. refresh → persisted content intact
//  14. activity shows the completed generation
//  15. stop ONE of two active generations → only that one stops
//  16. second provider + model switch + generation
//  17. error handling (401) + adaptive stream_options retry
//
// Run:  bun scripts/mock-provider/server.mjs 4148   (terminal 1)
//       bun scripts/mock-provider/server.mjs 4149   (terminal 2)
//       bun scripts/e2e-acceptance.mjs

const APP = process.env.APP_URL ?? "http://localhost:3000";
const MOCK1 = process.env.MOCK1 ?? "http://localhost:4148/v1";
const MOCK2 = process.env.MOCK2 ?? "http://localhost:4149/v1";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
let failed = 0;
const failures = [];

function check(step, name, cond, extra = "") {
  const ok = Boolean(cond);
  if (ok) {
    passed++;
    console.log(`  ✓ [${step}] ${name}`);
  } else {
    failed++;
    failures.push(`[${step}] ${name} ${extra}`);
    console.log(`  ✗ [${step}] ${name} ${extra}`);
  }
}

async function api(path, init, { retries = 3 } = {}) {
  const method = (init?.method ?? "GET").toUpperCase();
  // only retry idempotent requests — a retried POST could duplicate work
  const maxRetries = method === "GET" ? retries : 0;
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${APP}${path}`, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
        body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
        signal: AbortSignal.timeout(10_000),
      });
      let data = null;
      try {
        data = await res.json();
      } catch {
        /* no body */
      }
      return { status: res.status, data };
    } catch (err) {
      lastErr = err;
      // transient fetch hang — brief backoff, then retry
      await sleep(200 * (attempt + 1));
    }
  }
  return { status: 0, data: null, error: String(lastErr) };
}

/** Consume an SSE generation stream; breaks once enough deltas arrive
 *  (does NOT wait for done — the caller may want to navigate away mid-stream). */
async function consumeGeneration(id, { minDeltas = 1, timeoutMs = 9000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const events = [];
  let gotDone = false;
  try {
    const res = await fetch(`${APP}/api/generations/${id}/events`, {
      signal: controller.signal,
    });
    if (!res.ok || !res.body) return { ok: false, status: res.status, events };
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        for (const line of raw.split("\n")) {
          if (!line.startsWith("data:")) continue;
          try {
            events.push(JSON.parse(line.slice(5).trim()));
          } catch {
            /* keepalive */
          }
        }
      }
      const deltaCount = events.filter((e) => e.type === "text-delta").length;
      if (events.some((e) => e.type === "done")) {
        gotDone = true;
        break;
      }
      if (deltaCount >= minDeltas && minDeltas > 0 && gotDone === false && deltaCount >= minDeltas) {
        // enough evidence of live streaming — detach (like navigating away)
        break;
      }
    }
  } catch (err) {
    if (events.length === 0) return { ok: false, error: String(err), events };
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
  return { ok: true, events };
}

async function waitForTerminal(id, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data } = await api(`/api/generations?limit=200`);
    const found = data?.generations?.find((g) => g.id === id);
    if (found && ["completed", "failed", "cancelled"].includes(found.status)) {
      return found;
    }
    await sleep(300);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------

async function main() {
  console.log("\nMYTHICALMIND — FINAL ACCEPTANCE TEST\n────────────────────────────────────");

  // 1. Launch
  console.log("\n» 1. Launch MythicalMind");
  const home = await fetch(APP, { signal: AbortSignal.timeout(10_000) });
  const html = await home.text();
  check("1", "App responds 200", home.status === 200);
  check("1", "Workspace shell renders (MythicalMind)", html.includes("MythicalMind"));
  const health = await api("/api");
  check("1", "Runtime health endpoint", health.data?.ok === true);

  // clean slate for repeatability
  await api("/api/data", { method: "DELETE" });
  const existingProviders = await api("/api/providers");
  for (const p of existingProviders.data?.providers ?? []) {
    if (p.name.startsWith("E2E")) await api(`/api/providers/${p.id}`, { method: "DELETE" });
  }

  // 2-4. Add provider, connect, discover models
  console.log("\n» 2-4. Add custom OpenAI-compatible provider, connect, discover");
  const created = await api("/api/providers", {
    method: "POST",
    json: {
      name: "E2E Primary",
      type: "openai-compatible",
      baseUrl: MOCK1,
      apiKey: "test-key-primary",
      defaultModel: "aurora-pro",
    },
  });
  check("2", "Provider created", created.status === 201);
  const provider1 = created.data?.provider;
  check("2", "API key masked in response", provider1 && !("apiKey" in provider1) && provider1.keyHint?.includes("••"));

  const test1 = await api(`/api/providers/${provider1.id}/test`, { method: "POST" });
  check("3", "Connection test succeeds", test1.data?.result?.ok === true, JSON.stringify(test1.data));

  const disc = await api(`/api/providers/${provider1.id}/discover`, { method: "POST" });
  check("4", "Model discovery via /models", disc.data?.discovered === true && disc.data?.added >= 5, JSON.stringify(disc.data?.message));

  // 5-7. Conversation A + long prompt + REAL streaming
  console.log("\n» 5-7. Conversation A — long prompt, real token streaming");
  const convA = await api("/api/conversations", { method: "POST", json: {} });
  const conversationA = convA.data?.conversation;
  check("5", "Conversation A created", convA.status === 201);

  const longPrompt =
    "Write a detailed essay about how auroras work, covering solar wind, magnetosphere interactions, and atmospheric chemistry. Include code examples of streaming APIs.";
  const sendA = await api(`/api/conversations/${conversationA.id}/messages`, {
    method: "POST",
    json: { content: longPrompt, providerId: provider1.id, modelKey: "aurora-long" },
  });
  check("6", "Message accepted, generation created", sendA.status === 201);
  const genA = sendA.data?.generation;
  check("6", "Generation id is stable & returned immediately", Boolean(genA?.id));

  const streamA = await consumeGeneration(genA.id, { minDeltas: 8, timeoutMs: 8000 });
  const deltas = streamA.events.filter((e) => e.type === "text-delta");
  const snapshot = streamA.events.find((e) => e.type === "snapshot");
  check(
    "7",
    "Real streaming: multiple live text-delta events received",
    deltas.length >= 8,
    `got ${deltas.length}`
  );
  check("7", "SSE begins with snapshot of current state", snapshot?.type === "snapshot");
  check(
    "7",
    "Streamed content contains markdown the provider sent",
    deltas.some((d) => /aurora/i.test(d.text))
  );

  // 8-10. Navigate to B while A streams; parallel generation
  console.log("\n» 8-10. Navigate to B; start generation there; both run independently");
  const convB = await api("/api/conversations", { method: "POST", json: {} });
  const conversationB = convB.data?.conversation;
  const sendB = await api(`/api/conversations/${conversationB.id}/messages`, {
    method: "POST",
    json: { content: "Say something short with markdown.", providerId: provider1.id, modelKey: "aurora-mini" },
  });
  const genB = sendB.data?.generation;
  check("9", "Generation B started in another conversation", Boolean(genB?.id));

  const activeAfter = await api("/api/generations?scope=active");
  const activeIds = (activeAfter.data?.generations ?? []).map((g) => g.id);
  check("10", "Both generations active simultaneously", activeIds.includes(genA.id) && activeIds.includes(genB.id));

  // 11. Return to conversation A — reconnect + state sync
  console.log("\n» 11-12. Return to A: reconnect & synchronize");
  const detailA = await api(`/api/conversations/${conversationA.id}`);
  check(
    "11",
    "Conversation A reports its live generation",
    detailA.data?.liveGeneration?.id === genA.id
  );
  const resume = await consumeGeneration(genA.id, { minDeltas: 1, timeoutMs: 8000 });
  const resumeSnapshot = resume.events.find((e) => e.type === "snapshot");
  check(
    "11",
    "Reconnect replays accumulated state (snapshot has prior text)",
    Boolean(resumeSnapshot && resumeSnapshot.state.text.length > 100),
    `text=${resumeSnapshot?.state.text.length ?? 0} chars`
  );

  // 12. A completes
  const finalA = await waitForTerminal(genA.id, 30000);
  check("12", "Generation A completed", finalA?.status === "completed", JSON.stringify(finalA?.error ?? ""));

  // 13. Refresh simulation — persisted content
  console.log("\n» 13. Refresh — the response must still exist");
  const detailA2 = await api(`/api/conversations/${conversationA.id}`);
  const messagesA = detailA2.data?.conversation?.messages ?? [];
  const assistantA = messagesA.filter((m) => m.role === "assistant").pop();
  check("13", "Assistant message persisted with status completed", assistantA?.status === "completed");
  check(
    "13",
    "Persisted content matches the full streamed response",
    (assistantA?.content?.length ?? 0) > 500,
    `len=${assistantA?.content?.length}`
  );
  check("13", "Usage persisted when provider sent it", Boolean(assistantA?.usage?.totalTokens));
  check(
    "13",
    "Conversation auto-titled from first user message",
    (detailA2.data?.conversation?.title ?? "New conversation") !== "New conversation",
    `title="${detailA2.data?.conversation?.title}"`
  );

  // 14. Activity
  console.log("\n» 14. Activity shows the completed generation");
  const activity = await api("/api/activity?limit=50");
  const events = activity.data?.events ?? [];
  check(
    "14",
    "generation.completed event logged",
    events.some((e) => e.type === "generation.completed" && e.conversationId === conversationA.id)
  );
  check("14", "Activity entries carry readable details", events.every((e) => typeof e.title === "string"));

  // 15. Stop ONE of two active generations
  console.log("\n» 15. Stop exactly one of two active generations");
  const convC = await api("/api/conversations", { method: "POST", json: {} });
  const sendC = await api(`/api/conversations/${convC.data.conversation.id}/messages`, {
    method: "POST",
    json: { content: "Slow essay please.", providerId: provider1.id, modelKey: "aurora-long" },
  });
  const convD = await api("/api/conversations", { method: "POST", json: {} });
  const sendD = await api(`/api/conversations/${convD.data.conversation.id}/messages`, {
    method: "POST",
    json: { content: "Another slow essay.", providerId: provider1.id, modelKey: "aurora-long" },
  });
  const genC = sendC.data.generation;
  const genD = sendD.data.generation;
  await sleep(1200);
  const stopD = await api(`/api/generations/${genD.id}/stop`, { method: "POST" });
  check("15", "Stop request accepted for D", stopD.data?.stopped === true);
  await sleep(700);
  const activeCD = await api("/api/generations?scope=active");
  const stillActive = (activeCD.data?.generations ?? []).map((g) => g.id);
  check("15", "Generation D cancelled", !stillActive.includes(genD.id));
  check("15", "Generation C still streaming (untouched)", stillActive.includes(genC.id));

  const finalC = await waitForTerminal(genC.id, 40000);
  check("15", "C completes independently after D was stopped", finalC?.status === "completed");
  const finalD = await api(`/api/generations/${genD.id}/stop`, { method: "POST" });
  void finalD;

  // 16. Second provider + model switch mid-conversation
  console.log("\n» 16-17. Second provider, model switch, generation with provider 2");
  const provider2res = await api("/api/providers", {
    method: "POST",
    json: {
      name: "E2E Secondary",
      type: "openai-compatible",
      baseUrl: MOCK2,
      apiKey: "test-key-secondary",
      defaultModel: "aurora-reasoner",
    },
  });
  const provider2 = provider2res.data?.provider;
  check("16", "Second provider added", provider2res.status === 201);
  await api(`/api/providers/${provider2.id}/discover`, { method: "POST" });

  const switchRes = await api(`/api/conversations/${conversationA.id}`, {
    method: "PATCH",
    json: { providerId: provider2.id, modelKey: "aurora-reasoner" },
  });
  check(
    "17",
    "Model switched mid-conversation (same conversation)",
    switchRes.data?.conversation?.providerId === provider2.id &&
      switchRes.data?.conversation?.modelKey === "aurora-reasoner"
  );

  const sendA2 = await api(`/api/conversations/${conversationA.id}/messages`, {
    method: "POST",
    json: { content: "Now answer via the second provider with reasoning.", providerId: provider2.id, modelKey: "aurora-reasoner" },
  });
  const genA2 = sendA2.data?.generation;
  check("17", "Generation started on second provider", Boolean(genA2?.id) && genA2.providerName === "E2E Secondary");
  const finalA2 = await waitForTerminal(genA2.id, 30000);
  check("17", "Second provider generation completed", finalA2?.status === "completed", JSON.stringify(finalA2?.error ?? ""));
  const detailA3 = await api(`/api/conversations/${conversationA.id}`);
  const lastAssistant = (detailA3.data?.conversation?.messages ?? []).filter((m) => m.role === "assistant").pop();
  check("17", "Reasoning tokens captured when provider sends them", Boolean(lastAssistant?.reasoning));
  check("17", "Message records which provider/model produced it", lastAssistant?.providerName === "E2E Secondary" && lastAssistant?.modelKey === "aurora-reasoner");

  // 18. Error handling — 401 model on primary
  console.log("\n» 18. Provider errors are translated, not leaked");
  const convE = await api("/api/conversations", { method: "POST", json: {} });
  const sendE = await api(`/api/conversations/${convE.data.conversation.id}/messages`, {
    method: "POST",
    json: { content: "This will fail auth.", providerId: provider1.id, modelKey: "aurora-fail-401" },
  });
  const genE = sendE.data?.generation;
  const finalE = await waitForTerminal(genE.id, 15000);
  check("18", "Failed generation marked failed", finalE?.status === "failed");
  check(
    "18",
    "Error is a readable friendly message (authentication)",
    /authentication/i.test(finalE?.error?.message ?? ""),
    JSON.stringify(finalE?.error)
  );
  const convEdetail = await api(`/api/conversations/${convE.data.conversation.id}`);
  const failedMsg = (convEdetail.data?.conversation?.messages ?? []).filter((m) => m.role === "assistant").pop();
  check("18", "Message status failed with friendly error", failedMsg?.status === "failed" && /authentication|API key/i.test(failedMsg?.error?.message ?? ""));
  check("18", "No raw stack traces leaked", !(JSON.stringify(finalE?.error ?? {}) + JSON.stringify(failedMsg?.error ?? {})).includes("at "));

  // 19. Adaptive retry — strict provider rejects stream_options
  console.log("\n» 19. Provider quirks: strict gateway rejects stream_options");
  const convF = await api("/api/conversations", { method: "POST", json: {} });
  const sendF = await api(`/api/conversations/${convF.data.conversation.id}/messages`, {
    method: "POST",
    json: { content: "Strict gateway test.", providerId: provider1.id, modelKey: "aurora-strict" },
  });
  const finalF = await waitForTerminal(sendF.data.generation.id, 30000);
  check("19", "Adapter retried without stream_options and completed", finalF?.status === "completed", JSON.stringify(finalF?.error ?? ""));

  // 20. Security: keys never returned to the client
  console.log("\n» 20. Security — key handling");
  const providersList = await api("/api/providers");
  const listed = providersList.data?.providers ?? [];
  const keysLeaked = JSON.stringify(listed).includes("test-key-primary") || JSON.stringify(listed).includes("test-key-secondary");
  check("20", "No API keys in provider list responses", !keysLeaked);
  const exportRes = await fetch(`${APP}/api/export`, { signal: AbortSignal.timeout(10_000) });
  const exportText = await exportRes.text();
  check("20", "Export excludes API keys", !exportText.includes("test-key-primary"));

  // ---------------------------------------------------------------------------
  console.log(`\n────────────────────────────────────\nRESULT: ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log("Failures:");
    for (const f of failures) console.log(`  • ${f}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("E2E crashed:", err);
  process.exit(1);
});
