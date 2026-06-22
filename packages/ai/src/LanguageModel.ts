import { AnthropicClient, AnthropicLanguageModel } from "@effect/ai-anthropic";
import { OpenAiClient, OpenAiEmbeddingModel } from "@effect/ai-openai";
import { Config, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

const AnthropicLive = AnthropicClient.layerConfig({
  apiKey: Config.redacted("ANTHROPIC_API_KEY"),
}).pipe(Layer.provide(FetchHttpClient.layer));

const OpenAiLive = OpenAiClient.layerConfig({
  apiKey: Config.redacted("OPENAI_API_KEY"),
}).pipe(Layer.provide(FetchHttpClient.layer));

export const SmartModelLive = AnthropicLanguageModel.layer({
  model: "claude-sonnet-4-5",
}).pipe(Layer.provide(AnthropicLive));

export const FastModelLive = AnthropicLanguageModel.layer({
  model: "claude-haiku-4-5",
}).pipe(Layer.provide(AnthropicLive));

export const EmbeddingModelLive = OpenAiEmbeddingModel.layer({
  model: "text-embedding-3-small",
  config: { dimensions: 1536 },
}).pipe(Layer.provide(OpenAiLive));
