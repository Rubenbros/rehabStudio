import { describe, expect, it } from "vitest";
import { chat, type ChatMessage, type ToolSpec } from "@/lib/bot/llm";

/**
 * Prueba real contra Vertex AI (cuesta tokens y necesita ADC). Se salta salvo
 * que se pida explícitamente:
 *
 *   gcloud auth application-default login
 *   GOOGLE_CLOUD_PROJECT=rehab-studio-web VERTEX_LIVE_TEST=1 npx vitest run tests/bot/llm.live.test.ts
 *
 * Sirve para validar que el modelo de `GEMINI_MODEL` sigue disponible en
 * `VERTEX_LOCATION` y que el tool calling funciona antes de desplegar.
 */
const LIVE = process.env.VERTEX_LIVE_TEST === "1";

const TOOLS: ToolSpec[] = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "Devuelve los huecos libres de la agenda",
      parameters: {
        type: "object",
        properties: {
          days: { type: "integer", description: "Días a mirar", default: 14 },
          duration_min: { type: "integer", enum: [30, 60], description: "Duración" },
          schedule: { type: "object" },
        },
        required: ["duration_min"],
      },
    },
  },
];

describe.skipIf(!LIVE)("Vertex AI (llamada real)", () => {
  it("hace tool calling y cierra el bucle con el resultado de la herramienta", async () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "Eres el asistente de reservas de una clínica de fisioterapia." },
      { role: "system", content: `Now: ${new Date().toISOString()} (Europe/Madrid)` },
      {
        role: "user",
        content: "Dime qué huecos libres hay para una sesión de 60 minutos. Consulta la agenda.",
      },
    ];

    const first = await chat(messages, TOOLS);
    expect(first.finishReason).toBe("tool_calls");
    expect(first.message.tool_calls?.[0].function.name).toBe("check_availability");
    // El orquestador hace JSON.parse de esto: debe ser JSON válido.
    const args = JSON.parse(first.message.tool_calls![0].function.arguments);
    expect(args.duration_min).toBe(60);

    messages.push(first.message);
    for (const call of first.message.tool_calls ?? []) {
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify({ ok: true, data: [{ start: "2026-09-15T09:00:00+02:00" }] }),
      });
    }

    const second = await chat(messages, TOOLS);
    expect(second.finishReason).toBe("stop");
    expect(second.message.tool_calls).toBeUndefined();
    expect((second.message.content ?? "").length).toBeGreaterThan(0);
  }, 60_000);
});
