import { createFileRoute } from "@tanstack/react-router";

const SYSTEM = `You are GHIGHAIS AI, an expert front-end engineer.
Return ONE complete, self-contained HTML document (HTML + CSS + JS inline).
Rules:
- Output ONLY raw code. No markdown fences, no explanation.
- The document MUST run without any error in a browser sandbox.
- Always finish the document with a closing </html> tag.
- Use modern, beautiful, responsive design. No external build tools.
- You may use CDN links (tailwind, fonts) but the page must work offline-ish.
- Multi-page apps: use in-page sections/hash navigation, never separate files.
- Write text content in the language used by the user's instruction.`;

type GatewayInput =
  | string
  | Array<{
      role: "user" | "assistant";
      content: Array<{ type: "input_text" | "output_text"; text: string }>;
    }>;

function friendlyError(status: number, raw: string) {
  if (status === 402) {
    return "Kuota AI pada workspace habis. Tambahkan kredit untuk melanjutkan.";
  }
  if (status === 429) {
    return "Permintaan terlalu cepat. Tunggu sebentar lalu coba lagi.";
  }
  if (status === 401 || status === 403) {
    return "Layanan AI belum diizinkan untuk aplikasi ini.";
  }
  return raw || "Layanan AI sedang bermasalah, coba lagi.";
}

export const Route = createFileRoute("/api/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return new Response("AI belum dikonfigurasi", { status: 500 });
        }

        let body: { prompt?: string; currentCode?: string };
        try {
          body = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const prompt = (body.prompt ?? "").trim();
        if (!prompt) return new Response("Prompt kosong", { status: 400 });

        const firstInput =
          body.currentCode && body.currentCode.trim().length > 0
            ? `Existing document:\n\n${body.currentCode}\n\n---\nUser instruction: ${prompt}\n\nReturn the FULL updated document.`
            : `User instruction: ${prompt}`;

        async function callGateway(input: GatewayInput) {
          return fetch("https://ai.gateway.lovable.dev/v1/responses", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": apiKey!,
              "X-Lovable-AIG-SDK": "fetch",
            },
            body: JSON.stringify({
              model: "openai/gpt-6-astra",
              instructions: SYSTEM,
              input,
              stream: true,
              reasoning: { effort: "low" },
            }),
          });
        }

        const first = await callGateway(firstInput);
        if (!first.ok || !first.body) {
          const text = await first.text().catch(() => "");
          return new Response(friendlyError(first.status, text), {
            status: first.status || 500,
          });
        }

        const encoder = new TextEncoder();
        const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
        const writer = writable.getWriter();

        async function pump(response: Response, onDelta: (text: string) => Promise<void>) {
          const decoder = new TextDecoder();
          const reader = response.body!.getReader();
          let buffer = "";
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
                  await onDelta(evt.delta);
                }
              } catch {
                /* ignore partial frames */
              }
            }
          }
        }

        (async () => {
          let full = "";
          const write = async (delta: string) => {
            full += delta;
            await writer.write(encoder.encode(delta));
          };

          try {
            await pump(first, write);

            // Unlimited output: keep asking the model to continue until the
            // document is really finished. No token cap is ever sent.
            let attempts = 0;
            while (!full.toLowerCase().includes("</html>") && attempts < 8) {
              attempts += 1;
              const tail = full.slice(-6000);
              const next = await callGateway([
                {
                  role: "user",
                  content: [{ type: "input_text", text: firstInput }],
                },
                {
                  role: "assistant",
                  content: [{ type: "output_text", text: tail }],
                },
                {
                  role: "user",
                  content: [
                    {
                      type: "input_text",
                      text: "Continue the document EXACTLY where it stopped. Output only the remaining raw code, no repetition, no fences, and end with </html>.",
                    },
                  ],
                },
              ]);
              if (!next.ok || !next.body) break;
              const before = full.length;
              await pump(next, write);
              if (full.length === before) break;
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
