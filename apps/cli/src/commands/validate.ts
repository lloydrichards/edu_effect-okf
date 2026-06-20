import { OkfService } from "@repo/okf";
import { Array, Console, Data, Effect, Runtime } from "effect";
import { Command } from "effect/unstable/cli";
import { bundlePath } from "../args";
import { json } from "../flags";

class ValidateCommandFailed extends Data.TaggedError("ValidateCommandFailed")<{
  message: string;
}> {
  override readonly [Runtime.errorExitCode] = 1;
  override readonly [Runtime.errorReported] = false;
}

const formatIssues = (
  issues: ReadonlyArray<{ file: string; reason: string }>,
): ReadonlyArray<string> =>
  Array.map(issues, (issue) => `- ${issue.file}: ${issue.reason}`);

export const validate = Command.make(
  "validate",
  { bundlePath, json },
  ({ bundlePath, json }) =>
    Effect.gen(function* () {
      const okf = yield* OkfService;

      const result = yield* okf.validate(bundlePath).pipe(
        Effect.catchTag("BundleInvalid", (error) =>
          Effect.gen(function* () {
            const payload = {
              bundle: bundlePath,
              valid: false,
              issues: Array.map(error.issues, (issue) => ({
                id: issue.file,
                source:
                  issue.file.endsWith("/index.md") || issue.file === "index.md"
                    ? "index"
                    : issue.file.endsWith("/log.md") || issue.file === "log.md"
                      ? "log"
                      : "concept",
                reason: issue.reason,
                severity: "error" as const,
              })),
            };

            yield* Console.log(
              json
                ? JSON.stringify(payload, null, 2)
                : [
                    `Bundle invalid: ${bundlePath}`,
                    ...formatIssues(error.issues),
                  ].join("\n"),
            );

            return yield* new ValidateCommandFailed({
              message: `Bundle invalid: ${bundlePath}`,
            });
          }),
        ),
        Effect.catchTag("BundleNotFound", () =>
          Effect.gen(function* () {
            const message = `Bundle not found: ${bundlePath}`;

            yield* Console.log(
              json
                ? JSON.stringify(
                    {
                      error: "BundleNotFound",
                      bundlePath,
                      message,
                    },
                    null,
                    2,
                  )
                : message,
            );

            return yield* new ValidateCommandFailed({ message });
          }),
        ),
      );

      const payload = {
        bundle: bundlePath,
        valid: result.valid,
        issues: result.issues,
      };

      if (!result.valid) {
        yield* Console.log(
          json
            ? JSON.stringify(payload, null, 2)
            : [
                `Bundle invalid: ${bundlePath}`,
                ...Array.map(result.issues, (issue) => `- ${issue.reason}`),
              ].join("\n"),
        );

        return yield* new ValidateCommandFailed({
          message: `Bundle invalid: ${bundlePath}`,
        });
      }

      yield* Console.log(
        json ? JSON.stringify(payload, null, 2) : `Bundle valid: ${bundlePath}`,
      );
    }),
).pipe(Command.withDescription("Validate a bundle"));
