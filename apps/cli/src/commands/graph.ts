import { Console, Effect } from "effect";
import { Command } from "effect/unstable/cli";
import { bundlePath, conceptId } from "../args";

export const neighbors = Command.make(
  "neighbors",
  { bundlePath, conceptId },
  ({ bundlePath, conceptId }) =>
    Effect.gen(function* () {
      yield* Console.log(
        `Printing neighbors from concept with ID: ${conceptId} from bundle at path: ${bundlePath}`,
      );
    }),
).pipe(
  Command.withDescription("Print neighbors from a concept to another concept"),
);

export const path = Command.make(
  "path",
  { bundlePath, from: conceptId, to: conceptId },
  ({ bundlePath, from, to }) =>
    Effect.gen(function* () {
      yield* Console.log(
        `Printing path from concept with ID: ${from} to concept with ID: ${to} from bundle at path: ${bundlePath}`,
      );
    }),
).pipe(Command.withDescription("Print a path between two concepts"));

export const graph = Command.make("graph").pipe(
  Command.withSubcommands([neighbors, path]),
  Command.withDescription("Print a graph of concepts and their relationships"),
);
