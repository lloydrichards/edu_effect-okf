import { BunRuntime, BunServices } from "@effect/platform-bun";
import { EmbeddingModelLive } from "@repo/ai";
import { MarkdownService, OkfService } from "@repo/okf";
import { RagService } from "@repo/rag";
import { Effect, Layer } from "effect";
import { Command } from "effect/unstable/cli";
import { bundle } from "./commands/bundle";
import { concept } from "./commands/concept";
import { embed } from "./commands/embed";
import { graph } from "./commands/graph";
import { queryCommand } from "./commands/query";
import { validate } from "./commands/validate";

// ============================================================================
// Root Command
// ============================================================================

const root = Command.make("okf");

// ============================================================================
// Program
// ============================================================================

// Subcommands - modules inject additional subcommands via Command.withSubcommands
const AllCommands = Command.withSubcommands([
  concept,
  bundle,
  graph,
  validate,
  embed,
  queryCommand,
]);

const MainLayer = Layer.mergeAll(
  OkfService.layer,
  MarkdownService.layer,
  RagService.Default,
  EmbeddingModelLive,
).pipe(Layer.provideMerge(BunServices.layer));

root.pipe(
  AllCommands,
  Command.run({ version: "0.0.0" }),
  Effect.provide(MainLayer),
  BunRuntime.runMain,
);
