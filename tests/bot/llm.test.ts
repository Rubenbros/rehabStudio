import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ADC mockeada: nunca se pide un token real a Google en los tests unitarios.
const getAccessToken = vi.fn(async () => ({ token: "fake-adc-token" }));
const getProjectId = vi.fn(async () => "proyecto-por-adc");

vi.mock("google-auth-library", () => ({
  GoogleAuth: class {
    getClient = async () => ({ getAccessToken });
    getProjectId = getProjectId;
  },
}));

// El adaptador cachea el GoogleAuth y el projectId a nivel de módulo: se
// reimporta en cada test para que cada caso parta de cero.
async function loadChat() {
  vi.resetModules();
  const mod = await import("@/lib/bot/llm");
  return mod.chat;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function okCompletion(message: unknown, finishReason = "stop") {
  return { choices: [{ index: 0, message, finish_reason: finishReason }] };
}

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "check_availability",
      description: "Devuelve huecos libres",
      parameters: {
        type: "object",
        properties: { duration_min: { type: "integer", enum: [30, 60] } },
        required: ["duration_min"],
      },
    },
  },
];

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  process.env.GOOGLE_CLOUD_PROJECT = "rehab-studio-web";
  delete process.env.VERTEX_LOCATION;
  delete process.env.GEMINI_MODEL;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  delete process.env.GOOGLE_CLOUD_PROJECT;
  delete process.env.VERTEX_LOCATION;
  delete process.env.GEMINI_MODEL;
});

function lastRequest() {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, init, body: JSON.parse(init.body as string) };
}

describe("chat — petición a Vertex AI", () => {
  it("llama al endpoint OpenAI-compatible de la región con el token de ADC", async () => {
    const chat = await loadChat();
    fetchMock.mockResolvedValue(jsonResponse(okCompletion({ role: "assistant", content: "hola" })));

    await chat([{ role: "user", content: "hola" }]);

    const { url, init, body } = lastRequest();
    expect(url).toBe(
      "https://europe-west1-aiplatform.googleapis.com/v1/projects/rehab-studio-web" +
        "/locations/europe-west1/endpoints/openapi/chat/completions"
    );
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer fake-adc-token");
    expect(body.model).toBe("google/gemini-2.5-flash");
    expect(body.temperature).toBe(0.3);
    // Sin "thinking": este bot no lo necesita y evita las thought signatures.
    expect(body.extra_body).toEqual({ google: { thinking_config: { thinking_budget: 0 } } });
  });

  it("respeta VERTEX_LOCATION y GEMINI_MODEL", async () => {
    process.env.VERTEX_LOCATION = "us-central1";
    process.env.GEMINI_MODEL = "google/gemini-2.5-pro";
    const chat = await loadChat();
    fetchMock.mockResolvedValue(jsonResponse(okCompletion({ role: "assistant", content: "ok" })));

    await chat([{ role: "user", content: "hola" }]);

    const { url, body } = lastRequest();
    expect(url).toContain("https://us-central1-aiplatform.googleapis.com/");
    expect(url).toContain("/locations/us-central1/");
    expect(body.model).toBe("google/gemini-2.5-pro");
  });

  it("usa el host sin prefijo de región cuando la location es global", async () => {
    process.env.VERTEX_LOCATION = "global";
    const chat = await loadChat();
    fetchMock.mockResolvedValue(jsonResponse(okCompletion({ role: "assistant", content: "ok" })));

    await chat([{ role: "user", content: "hola" }]);

    expect(lastRequest().url).toBe(
      "https://aiplatform.googleapis.com/v1/projects/rehab-studio-web" +
        "/locations/global/endpoints/openapi/chat/completions"
    );
  });

  it("deduce el proyecto por ADC si GOOGLE_CLOUD_PROJECT no está definida", async () => {
    delete process.env.GOOGLE_CLOUD_PROJECT;
    const chat = await loadChat();
    fetchMock.mockResolvedValue(jsonResponse(okCompletion({ role: "assistant", content: "ok" })));

    await chat([{ role: "user", content: "hola" }]);

    expect(getProjectId).toHaveBeenCalled();
    expect(lastRequest().url).toContain("/projects/proyecto-por-adc/");
  });

  it("envía las tools tal cual con tool_choice auto", async () => {
    const chat = await loadChat();
    fetchMock.mockResolvedValue(jsonResponse(okCompletion({ role: "assistant", content: "ok" })));

    await chat([{ role: "user", content: "huecos?" }], TOOLS);

    const { body } = lastRequest();
    expect(body.tools).toEqual(TOOLS);
    expect(body.tool_choice).toBe("auto");
  });

  it("omite tools y tool_choice cuando no hay herramientas", async () => {
    const chat = await loadChat();
    fetchMock.mockResolvedValue(jsonResponse(okCompletion({ role: "assistant", content: "ok" })));

    await chat([{ role: "user", content: "hola" }]);

    const { body } = lastRequest();
    expect(body).not.toHaveProperty("tools");
    expect(body).not.toHaveProperty("tool_choice");
  });

  it("reenvía el historial completo, incluidos varios system y los mensajes tool", async () => {
    const chat = await loadChat();
    fetchMock.mockResolvedValue(jsonResponse(okCompletion({ role: "assistant", content: "ok" })));
    const history = [
      { role: "system" as const, content: "Eres el asistente" },
      { role: "system" as const, content: "Now: 2026-09-09T10:00:00.000Z" },
      { role: "user" as const, content: "huecos?" },
      {
        role: "assistant" as const,
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function" as const,
            function: { name: "check_availability", arguments: '{"duration_min":60}' },
          },
        ],
      },
      { role: "tool" as const, tool_call_id: "call_1", content: '{"ok":true}' },
    ];

    await chat(history, TOOLS);

    expect(lastRequest().body.messages).toEqual(history);
  });
});

describe("chat — normalización de la respuesta", () => {
  it("devuelve los tool_calls con el contrato que espera el orquestador", async () => {
    const chat = await loadChat();
    fetchMock.mockResolvedValue(
      jsonResponse(
        okCompletion(
          {
            role: "assistant",
            tool_calls: [
              {
                id: "function-call-abc",
                type: "function",
                function: { name: "check_availability", arguments: '{"duration_min":60}' },
              },
            ],
          },
          "tool_calls"
        )
      )
    );

    const { message, finishReason } = await chat([{ role: "user", content: "huecos?" }], TOOLS);

    expect(finishReason).toBe("tool_calls");
    expect(message.role).toBe("assistant");
    // Gemini omite `content` cuando llama a una herramienta: se normaliza a null.
    expect(message.content).toBeNull();
    expect(message.tool_calls).toEqual([
      {
        id: "function-call-abc",
        type: "function",
        function: { name: "check_availability", arguments: '{"duration_min":60}' },
      },
    ]);
    // El orquestador hace JSON.parse de arguments: debe ser string.
    expect(typeof message.tool_calls![0].function.arguments).toBe("string");
  });

  it("serializa arguments si el proveedor los manda como objeto y rellena el id", async () => {
    const chat = await loadChat();
    fetchMock.mockResolvedValue(
      jsonResponse(
        okCompletion(
          {
            role: "assistant",
            tool_calls: [
              { function: { name: "check_availability", arguments: { duration_min: 30 } } },
            ],
          },
          "tool_calls"
        )
      )
    );

    const { message } = await chat([{ role: "user", content: "huecos?" }], TOOLS);

    expect(message.tool_calls).toEqual([
      {
        id: "call_0",
        type: "function",
        function: { name: "check_availability", arguments: '{"duration_min":30}' },
      },
    ]);
  });

  it("conserva extra_content (thought signatures) del mensaje y de cada tool call", async () => {
    const chat = await loadChat();
    fetchMock.mockResolvedValue(
      jsonResponse(
        okCompletion(
          {
            role: "assistant",
            extra_content: { google: { thought_signature: "abc" } },
            tool_calls: [
              {
                id: "c1",
                type: "function",
                function: { name: "check_availability", arguments: "{}" },
                extra_content: { google: { thought_signature: "def" } },
              },
            ],
          },
          "tool_calls"
        )
      )
    );

    const { message } = await chat([{ role: "user", content: "huecos?" }], TOOLS);

    expect(message.extra_content).toEqual({ google: { thought_signature: "abc" } });
    expect(message.tool_calls![0].extra_content).toEqual({
      google: { thought_signature: "def" },
    });
  });

  it("no añade tool_calls cuando la respuesta es solo texto", async () => {
    const chat = await loadChat();
    fetchMock.mockResolvedValue(
      jsonResponse(okCompletion({ role: "assistant", content: "Tengo el martes a las 10." }))
    );

    const { message, finishReason } = await chat([{ role: "user", content: "huecos?" }]);

    expect(message).toEqual({ role: "assistant", content: "Tengo el martes a las 10." });
    expect(finishReason).toBe("stop");
  });

  it("usa 'stop' si el proveedor no manda finish_reason", async () => {
    const chat = await loadChat();
    fetchMock.mockResolvedValue(
      jsonResponse({ choices: [{ message: { role: "assistant", content: "ok" } }] })
    );

    expect((await chat([{ role: "user", content: "hola" }])).finishReason).toBe("stop");
  });
});

describe("chat — errores", () => {
  it("extrae el mensaje del error de Vertex y lo propaga con el status", async () => {
    const chat = await loadChat();
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: { code: 429, message: "Resource exhausted. Please try again later." } },
        429
      )
    );

    await expect(chat([{ role: "user", content: "hola" }])).rejects.toThrow(
      "Vertex AI error 429: Resource exhausted. Please try again later."
    );
  });

  it("entiende el error envuelto en array que devuelve Vertex", async () => {
    const chat = await loadChat();
    fetchMock.mockResolvedValue(
      jsonResponse(
        [{ error: { code: 403, message: "Permission denied on resource project." } }],
        403
      )
    );

    await expect(chat([{ role: "user", content: "hola" }])).rejects.toThrow(
      "Vertex AI error 403: Permission denied on resource project."
    );
  });

  it("recorta el cuerpo cuando el error no es JSON (no volcamos payloads enteros a los logs)", async () => {
    const chat = await loadChat();
    fetchMock.mockResolvedValue(new Response("x".repeat(5000), { status: 502 }));

    const err = await chat([{ role: "user", content: "hola" }]).catch((e: Error) => e);

    expect((err as Error).message).toMatch(/^Vertex AI error 502: x{500}$/);
  });

  it("falla claro si la respuesta no trae choices (p. ej. bloqueo por safety)", async () => {
    const chat = await loadChat();
    fetchMock.mockResolvedValue(jsonResponse({ choices: [] }));

    await expect(chat([{ role: "user", content: "hola" }])).rejects.toThrow(
      "Vertex AI returned no choices"
    );
  });

  it("falla si ADC no devuelve token en vez de mandar un Bearer vacío", async () => {
    getAccessToken.mockResolvedValueOnce({ token: "" } as { token: string });
    const chat = await loadChat();

    await expect(chat([{ role: "user", content: "hola" }])).rejects.toThrow(
      "ADC returned no access token"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("configuración por entorno", () => {
  it("cae a los valores por defecto si las variables llegan vacías desde Cloud Run", async () => {
    process.env.VERTEX_LOCATION = "";
    process.env.GEMINI_MODEL = "";
    const chat = await loadChat();
    fetchMock.mockResolvedValue(jsonResponse(okCompletion({ role: "assistant", content: "ok" })));

    await chat([{ role: "user", content: "hola" }]);

    const { url, body } = lastRequest();
    expect(url).toContain("europe-west1-aiplatform.googleapis.com");
    expect(body.model).toBe("google/gemini-2.5-flash");
  });
});
