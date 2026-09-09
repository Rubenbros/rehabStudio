import { GoogleAuth } from "google-auth-library";
import { env } from "./env";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  /**
   * Campos propios del proveedor (p. ej. `thought_signature` de Gemini cuando el
   * "thinking" está activo). No se interpretan: se devuelven tal cual para que el
   * orquestador pueda reenviar el mensaje del asistente sin perder información.
   */
  extra_content?: unknown;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
  extra_content?: unknown;
}

export interface ToolSpec {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatResponse {
  message: ChatMessage;
  finishReason: string;
}

const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const TEMPERATURE = 0.3;

/**
 * Gemini 2.5 activa el "thinking" por defecto: añade cientos de tokens de
 * razonamiento y latencia a turnos que aquí son cortos (chat de reservas con
 * tool calling), y obliga a reenviar las `thought_signature` entre iteraciones.
 * Lo desactivamos explícitamente; verificado contra Vertex (europe-west1) que
 * el tool calling sigue funcionando igual sin él.
 */
const THINKING_BUDGET = 0;

/** Límite del cuerpo de error que propagamos: los errores acaban en logs. */
const MAX_ERROR_CHARS = 500;

let auth: GoogleAuth | null = null;
let cachedProjectId: string | null = null;

function getAuth(): GoogleAuth {
  auth ??= new GoogleAuth({ scopes: [CLOUD_PLATFORM_SCOPE] });
  return auth;
}

/**
 * Proyecto de GCP contra el que se factura Vertex. En Cloud Run llega por
 * `GOOGLE_CLOUD_PROJECT`; si no está, se resuelve por ADC (metadata server en
 * Cloud Run, `gcloud auth application-default` en local).
 */
async function resolveProjectId(): Promise<string> {
  if (cachedProjectId) return cachedProjectId;
  const fromEnv = env.googleCloudProject();
  if (fromEnv) {
    cachedProjectId = fromEnv;
    return cachedProjectId;
  }
  const detected = await getAuth().getProjectId();
  if (!detected) throw new Error("Cannot resolve GOOGLE_CLOUD_PROJECT for Vertex AI");
  cachedProjectId = detected;
  return cachedProjectId;
}

async function accessToken(): Promise<string> {
  const client = await getAuth().getClient();
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Vertex AI: ADC returned no access token");
  return token;
}

/** La location `global` no lleva prefijo de región en el host. */
function apiHost(location: string): string {
  return location === "global"
    ? "aiplatform.googleapis.com"
    : `${location}-aiplatform.googleapis.com`;
}

function chatCompletionsUrl(projectId: string, location: string): string {
  return (
    `https://${apiHost(location)}/v1/projects/${projectId}` +
    `/locations/${location}/endpoints/openapi/chat/completions`
  );
}

/**
 * Extrae el mensaje útil de un error de Vertex (`{ error: { message } }` o un
 * array de esos objetos) y lo recorta. Evita volcar el cuerpo entero —que puede
 * incluir eco de la petición— en los logs.
 */
function describeError(body: string): string {
  try {
    const parsed = JSON.parse(body);
    const first = Array.isArray(parsed) ? parsed[0] : parsed;
    const message = first?.error?.message;
    if (typeof message === "string" && message) return message.slice(0, MAX_ERROR_CHARS);
  } catch {
    // Cuerpo no-JSON (HTML de un proxy, texto plano…): cae al recorte crudo.
  }
  return body.slice(0, MAX_ERROR_CHARS);
}

interface RawToolCall {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: unknown };
  extra_content?: unknown;
}

/**
 * Normaliza los tool calls al contrato exacto que espera el orquestador:
 * `id` no vacío y `function.arguments` **siempre** string JSON (Gemini lo manda
 * ya serializado, pero un objeto colaría si el endpoint cambia de forma).
 */
function normalizeToolCalls(raw: unknown): ToolCall[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw.map((call: RawToolCall, index) => {
    const args = call?.function?.arguments;
    return {
      id: call?.id || `call_${index}`,
      type: "function" as const,
      function: {
        name: call?.function?.name ?? "",
        arguments: typeof args === "string" ? args : JSON.stringify(args ?? {}),
      },
      ...(call?.extra_content !== undefined ? { extra_content: call.extra_content } : {}),
    };
  });
}

/**
 * Wrapper sobre el endpoint OpenAI-compatible de Vertex AI (Gemini).
 *
 * Autenticación por ADC: en Cloud Run la da la cuenta de servicio del servicio
 * (necesita `roles/aiplatform.user`), en local `gcloud auth application-default
 * login`. No hay ninguna API key.
 */
export async function chat(messages: ChatMessage[], tools?: ToolSpec[]): Promise<ChatResponse> {
  const location = env.vertexLocation();
  const [projectId, token] = await Promise.all([resolveProjectId(), accessToken()]);

  const res = await fetch(chatCompletionsUrl(projectId, location), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: env.geminiModel(),
      messages,
      tools,
      tool_choice: tools ? "auto" : undefined,
      temperature: TEMPERATURE,
      extra_body: { google: { thinking_config: { thinking_budget: THINKING_BUDGET } } },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Vertex AI error ${res.status}: ${describeError(errText)}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  if (!choice) throw new Error("Vertex AI returned no choices");

  const raw = choice.message ?? {};
  const message: ChatMessage = {
    role: "assistant",
    content: typeof raw.content === "string" ? raw.content : null,
  };
  const toolCalls = normalizeToolCalls(raw.tool_calls);
  if (toolCalls) message.tool_calls = toolCalls;
  if (raw.extra_content !== undefined) message.extra_content = raw.extra_content;

  return {
    message,
    finishReason: choice.finish_reason ?? "stop",
  };
}
