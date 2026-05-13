import { env } from "./env";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
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

/**
 * Thin wrapper around DeepSeek's OpenAI-compatible chat endpoint.
 */
export async function chat(messages: ChatMessage[], tools?: ToolSpec[]): Promise<ChatResponse> {
  const res = await fetch(`${env.deepseekBase()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.deepseekKey()}`,
    },
    body: JSON.stringify({
      model: env.deepseekModel(),
      messages,
      tools,
      tool_choice: tools ? "auto" : undefined,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DeepSeek error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  if (!choice) throw new Error("DeepSeek returned no choices");

  return {
    message: choice.message,
    finishReason: choice.finish_reason,
  };
}
