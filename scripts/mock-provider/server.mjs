// MythicalMind E2E mock provider — a REAL OpenAI-compatible HTTP server.
//
//   GET  /v1/models                → model list
//   POST /v1/chat/completions      → SSE streaming (or JSON when stream:false)
//
// Special models:
//   aurora-pro        long streamed answer (~120 chunks, 45ms apart) + usage
//   aurora-mini       short answer (~20 chunks)
//   aurora-reasoner   emits reasoning_content deltas before content + usage
//   aurora-slow       very slow stream (~50s) for stop/navigation tests
//   aurora-fail-401   responds 401 (tests friendly error mapping)
//   aurora-fail-500   responds 503 (tests provider-unavailable mapping)
//   aurora-strict     rejects stream_options with 400 (tests adaptive retry)
//
// Run: bun scripts/mock-provider/server.mjs [port]

import http from "node:http";

const PORT = Number(process.argv[2] ?? 4148);
const MODELS = [
  { id: "aurora-mini" },
  { id: "aurora-pro" },
  { id: "aurora-long" },
  { id: "aurora-reasoner" },
  { id: "aurora-slow" },
  { id: "aurora-strict" },
  { id: "aurora-fail-401" },
  { id: "aurora-fail-500" },
];

// Rundown-mode detection: the MythicalMind rundown prompt carries this marker.
function isRundownRequest(system, prompt) {
  return (
    system.includes("perencana acara") ||
    system.includes("rundown") ||
    prompt.includes("Nama acara/rencana:")
  );
}

function buildRundownChunks(system, prompt) {
  // extend mode: only additional segments
  if (prompt.includes("TAMBAHKAN segmen")) {
    const obj = {
      title: "Segmen tambahan",
      description: null,
      suggestedStartTime: null,
      segments: [
        { title: "Sesi door prize", durationMinutes: 15, description: "Undian hadiah untuk peserta.", pic: "MC", notes: null },
        { title: "Arak-arakan penutup", durationMinutes: 10, description: "Konfeti dan foto bersama.", pic: "Tim Acara", notes: "Siapkan konfeti." },
      ],
    };
    return chunkify(JSON.stringify(obj), 90);
  }
  const titleMatch = prompt.match(/Nama acara\/rencana: (.+)/);
  const title = (titleMatch?.[1] ?? "Acara")?.split("\n")[0];
  const startMatch = prompt.match(/Jam mulai: (\d{1,2}:\d{2})/);
  const start = startMatch?.[1] ?? "08:00";
  const obj = {
    title,
    description: `Rundown profesional untuk ${title}, disusun otomatis oleh mock provider.`,
    suggestedStartTime: start,
    segments: [
      { title: "Persiapan & cek venue", durationMinutes: 30, description: "Tim tiba, cek peralatan dan tata ruang.", pic: "Koordinator", notes: "Bawa cadangan kabel listrik." },
      { title: "Registrasi peserta", durationMinutes: 45, description: "Pembukaan meja registrasi dan pembagian kit.", pic: "Tim Registrasi", notes: "Siapkan name tag." },
      { title: "Pembukaan & sambutan", durationMinutes: 20, description: "MC membuka acara dan sambutan penyelenggara.", pic: "MC", notes: null },
      { title: "Sesi inti", durationMinutes: 60, description: "Materi utama acara.", pic: "Narasumber", notes: "Cek slide H-1." },
      { title: "Tanya jawab & diskusi", durationMinutes: 30, description: "Sesi interaktif peserta.", pic: "Moderator", notes: "Siapkan 3 pertanyaan cadangan." },
      { title: "Makan bersama", durationMinutes: 45, description: "Jeda kuliner dan networking.", pic: "Logistik", notes: null },
      { title: "Penutupan & foto", durationMinutes: 20, description: "Ucapan terima kasih dan dokumentasi.", pic: "MC + Dokumentasi", notes: null },
    ],
  };
  return chunkify(JSON.stringify(obj), 90);
}

function chunkify(text, size) {
  const parts = [];
  for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size));
  return parts;
}

const LOREM_PARAS = [
  "The aurora does not burn; it breathes. Charged particles arrive on solar wind, slip along field lines, and surrender their energy to the thin air above the poles in waves of violet and green.",
  "A streaming response is a promise delivered in pieces. The client does not wait for the whole answer — it listens, and the answer grows.",
  "Architecture is what remains when the interface is closed. The generation lives above the page, in the runtime, beyond the lifetime of any single view.",
  "Providers differ in small ways: some send usage, some refuse stream_options, some whisper their reasoning before they speak. The adapter absorbs these differences so the workspace does not have to.",
  "Persistence is memory with a schedule. Tokens arrive, the runtime accumulates, and the database learns about them in quiet, batched intervals.",
];

function buildChunks(model, prompt) {
  const mention = `You said: "${prompt.slice(0, 60)}"`;
  if (model === "aurora-mini") {
    return [
      "Here is a short answer.\n\n",
      "Aurora Mini streams **markdown** with a `code` block:\n\n",
      "```js\nconst stream = true;\nconsole.log(\"hello aurora\");\n```\n\n",
      "Done.",
    ];
  }
  const parts = [`${mention}\n\n`];
  const paras =
    model === "aurora-slow" ? 60 : model === "aurora-long" ? 30 : 6;
  for (let i = 0; i < paras; i++) {
    parts.push(`## Section ${i + 1}\n\n`);
    parts.push(LOREM_PARAS[i % LOREM_PARAS.length] + "\n\n");
    if (i === 2) {
      parts.push("```python\ndef aurora(n: int) -> int:\n    return n * 42\n```\n\n");
    }
  }
  parts.push("_Streamed by the MythicalMind mock provider._");
  return parts;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS (not needed by MythicalMind server-side calls, but harmless)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");
  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/v1/models") {
    if (checkAuth(req, res)) return;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ object: "list", data: MODELS }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
    if (checkAuth(req, res)) return;
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let json;
      try {
        json = JSON.parse(body);
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { message: "invalid JSON" } }));
        return;
      }

      const model = json.model ?? "";
      const prompt =
        (json.messages ?? []).filter((m) => m.role === "user").slice(-1)[0]?.content ?? "";
      const systemMsg =
        (json.messages ?? []).filter((m) => m.role === "system").slice(-1)[0]?.content ?? "";
      const rundownMode = isRundownRequest(systemMsg, prompt);

      // auth / availability failure models
      if (model === "aurora-fail-401") {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ error: { message: "Incorrect API key provided." } })
        );
        return;
      }
      if (model === "aurora-fail-500") {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { message: "model overloaded" } }));
        return;
      }
      // strict gateways reject stream_options — 400 mentioning the field
      if (model === "aurora-strict" && json.stream_options) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: {
              message: "Unrecognized request argument supplied: stream_options",
              type: "invalid_request_error",
            },
          })
        );
        return;
      }

      const wantsUsage = Boolean(json.stream_options?.include_usage);
      const chunks = rundownMode
        ? buildRundownChunks(systemMsg, prompt)
        : buildChunks(model, prompt);
      const chunkDelay = rundownMode
        ? 25
        : model === "aurora-slow" ? 700 : model === "aurora-long" ? 400 : model === "aurora-pro" ? 45 : 60;
      const hasReasoning = model === "aurora-reasoner";

      // non-streaming
      if (!json.stream) {
        const text = chunks.join("");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            id: "chatcmpl-mock",
            object: "chat.completion",
            model,
            choices: [
              {
                index: 0,
                message: { role: "assistant", content: text },
                finish_reason: "stop",
              },
            ],
            usage: {
              prompt_tokens: Math.ceil(prompt.length / 4),
              completion_tokens: Math.ceil(text.length / 4),
              total_tokens: Math.ceil((prompt.length + text.length) / 4),
            },
          })
        );
        return;
      }

      // SSE streaming
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      const id = `chatcmpl-${Math.random().toString(36).slice(2, 10)}`;
      const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
      const heartbeat = setInterval(() => res.write(": ping\n\n"), 5000);

      let clientGone = false;
      // NOTE: listen on the RESPONSE, not the request — req 'close' fires as
      // soon as the body is consumed, which would kill the stream instantly.
      res.on("close", () => {
        clientGone = true;
        clearInterval(heartbeat);
      });

      const emitChunk = (delta) =>
        send({
          id,
          object: "chat.completion.chunk",
          model,
          choices: [{ index: 0, delta, finish_reason: null }],
        });

      // role chunk first
      emitChunk({ role: "assistant", content: "" });

      let i = 0;
      const step = () => {
        if (clientGone) {
          clearInterval(heartbeat);
          return;
        }
        if (i < chunks.length) {
          if (hasReasoning && i === 1) {
            // reasoning deltas (DeepSeek-style)
            emitChunk({
              reasoning_content:
                "Let me think about this request carefully before answering.",
            });
          }
          emitChunk({ content: chunks[i] });
          i++;
          setTimeout(step, chunkDelay);
        } else {
          // final chunk with finish + usage
          send({
            id,
            object: "chat.completion.chunk",
            model,
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
            ...(wantsUsage
              ? {
                  usage: {
                    prompt_tokens: Math.ceil(prompt.length / 4),
                    completion_tokens: Math.ceil(chunks.join("").length / 4),
                    total_tokens: Math.ceil(
                      (prompt.length + chunks.join("").length) / 4
                    ),
                  },
                }
              : {}),
          });
          res.write("data: [DONE]\n\n");
          clearInterval(heartbeat);
          res.end();
        }
      };
      setTimeout(step, 30);
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: { message: `no route ${url.pathname}` } }));
});

function checkAuth(req, res) {
  const auth = req.headers.authorization ?? "";
  if (!auth.startsWith("Bearer ")) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: "missing bearer token" } }));
    return true;
  }
  return false;
}

server.listen(PORT, () => {
  console.log(`[mock-provider] listening on http://localhost:${PORT}/v1`);
});
