import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Effect } from "effect";
import { Command } from "effect/unstable/cli";
import { hello } from "./commands/hello";

// ============================================================================
// Root Command
// ============================================================================

const root = Command.make("cli");

// ============================================================================
// Program
// ============================================================================

// Subcommands - modules inject additional subcommands via Command.withSubcommands
const AllCommands = Command.withSubcommands([hello]);

root.pipe(
  AllCommands,
  Command.run({ version: "0.0.0" }),
  Effect.provide(BunServices.layer),
  BunRuntime.runMain,
);
