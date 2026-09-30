// MythicalMind — provider adapter registry.
// New protocol families (future providers) register themselves here; nothing
// else in the application needs to know about concrete providers.

import type { ProviderConfig, StreamRequest, ProviderAdapter } from "./openai-compatible";
import { OpenAICompatibleAdapter } from "./openai-compatible";
import { ProviderError } from "./errors";
import type { StreamEvent } from "@/lib/types";

export type { ProviderConfig, StreamRequest, DiscoveredModel, PingResult } from "./openai-compatible";

class ProviderRegistry {
  private adapters = new Map<string, ProviderAdapter>();

  register(adapter: ProviderAdapter) {
    this.adapters.set(adapter.type, adapter);
  }

  get(type: string): ProviderAdapter {
    const adapter = this.adapters.get(type);
    if (!adapter) {
      throw new ProviderError({
        code: "unknown_provider_type",
        message: `Unknown API type "${type}".`,
        hint: "Supported today: openai-compatible.",
      });
    }
    return adapter;
  }

  listTypes(): { type: string; label: string; description: string }[] {
    return [
      {
        type: "openai-compatible",
        label: "OpenAI-compatible",
        description:
          "Any endpoint implementing POST /chat/completions with Bearer auth — OpenRouter, Groq, Together, Fireworks, DeepSeek, Ollama, vLLM, LM Studio, LocalAI, private gateways.",
      },
    ];
  }
}

const globalForRegistry = globalThis as unknown as {
  __mythicalmind_registry?: ProviderRegistry;
};

export const registry: ProviderRegistry =
  globalForRegistry.__mythicalmind_registry ?? new ProviderRegistry();

registry.register(new OpenAICompatibleAdapter());

export { OpenAICompatibleAdapter };
