import { OkfService } from "@repo/okf";
import { Console, Effect } from "effect";
import { Command } from "effect/unstable/cli";
import { Box } from "effect-boxes";
import { bundlePath } from "../args";

export const index = Command.make("index", { bundlePath }, ({ bundlePath }) =>
  Effect.gen(function* () {
    const okf = yield* OkfService;

    const { bundle } = yield* okf.make(bundlePath);

    yield* Effect.forEach(
      bundle.indexFiles,
      Effect.fnUntraced(function* (file) {
        const content = yield* Box.renderPretty(
          Box.vcat(
            [
              Box.hsep(
                [Box.text(file.path), Box.text(file.version ?? "")],
                1,
                Box.left,
              ),
              Box.text(file.content).pipe(Box.border("rounded")),
            ],
            Box.left,
          ),
        );
        yield* Console.log(content);
      }),
    );
  }),
).pipe(Command.withDescription("Index for the OKF bundle"));

export const bundle = Command.make("bundle", { bundlePath }, ({ bundlePath }) =>
  Effect.gen(function* () {
    const okf = yield* OkfService;

    const { bundle } = yield* okf.make(bundlePath);

    const content = yield* Box.renderPretty(
      Box.vcat(
        [
          Box.hsep(
            [Box.text("Bundle Path:"), Box.text(bundle.root)],
            1,
            Box.left,
          ),
        ],
        Box.left,
      ),
    );
    yield* Console.log(content);
  }),
).pipe(
  Command.withSubcommands([index]),
  Command.withDescription("Commands for working with OKF bundles"),
);
