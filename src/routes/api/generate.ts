import { createFileRoute } from "@tanstack/react-router";

const SYSTEM = `You are GHIGHAIS AI, an expert front-end engineer.
Return ONE complete, self-contained HTML document (HTML + CSS + JS inline).
Rules:
- Output ONLY raw code. No markdown fences, no explanation.
- The document MUST run without any error in a browser sandbox.
- Use modern, beautiful, responsive design. No external build tools.
- You may use CDN links (tailwind, fonts) but the page must work offline-ish.
- Multi-page apps: use in-page sections/hash navigation, never separate files.
- Write text content in the language used by the user's instruction.`;

export const Route = createFileRoute("/api/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return new Response("AI belum dikonfigurasi", { status: 500 });
        }

        let body: { prompt?: string; currentCode?: string; mode?: string };
        try {
          body = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const prompt = (body.prompt ?? "").trim();
        if (!prompt) return new Response("Prompt kosong", { status: 400 });

        const input =
          body.currentCode && body.currentCode.trim().length > 0
            ? `Existing document:\n\n${body.currentCode}\n\n---\nUser instruction: ${prompt}\n\nReturn the FULL updated document.`
            : `User instruction: ${prompt}`;

        console.log("[gen] calling gateway");
        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": apiKey,
            "X-Lovable-AIG-SDK": "fetch",
          },
          body: JSON.stringify({
            model: "openai/gpt-6-astra",
            instructions: SYSTEM,
            input,
            stream: true,
            reasoning: { effort: "low", summary: "auto" },
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          return new Response(text || "AI error", { status: upstream.status || 500 });
        }

        const encoder = new TextEncoder();
        const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
        const writer = writable.getWriter();

        (async () => {
          const decoder = new TextDecoder();
          const reader = upstream.body!.getReader();
          let buffer = "";
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";
              for (const line of lines) {
                if (!line.startsWith("data:")) continue;
                const payload = line.slice(5).trim();
                if (!payload || payload === "[DONE]") continue;
                try {
                  const evt = JSON.parse(payload) as { type?: string; delta?: string };
                  if (evt.type === "response.output_text.delta" && evt.delta) {
                    await writer.write(encoder.encode(evt.delta));
                  }
                } catch {
                  /* ignore partial frames */
                }
              }
            }
          } catch {
            /* upstream ended unexpectedly */
          } finally {
            try {
              await writer.close();
            } catch {
              /* already closed */
            }
          }
        })();

        return new Response(readable, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
