import { OkfSourceInput, ResolvedOkfSource } from "@repo/domain/Okf";
import {
  Array as Arr,
  Config,
  Context,
  Data,
  Effect,
  FileSystem,
  Layer,
  Match,
  Option,
  Path,
  pipe,
  Schema,
  String as Str,
} from "effect";
import { GitService } from "./GitService";

export class SourceParseError extends Data.TaggedError("SourceParseError")<{
  readonly input: string;
  readonly reason: string;
}> {}

export class SourceResolveError extends Data.TaggedError("SourceResolveError")<{
  readonly input: string;
  readonly reason: string;
}> {}

const gitFragmentPattern = /^(.+?)(?:#([^:]+):(.+))$/;

export const parseOkfSourceInput = Effect.fn("parseOkfSourceInput")(function* (
  input: string,
) {
  const trimmed = Str.trim(input);

  if (Str.isEmpty(trimmed)) {
    return yield* new SourceParseError({
      input,
      reason: "Input cannot be empty",
    });
  }

  const githubTree = yield* parseGitHubTreeUrl(trimmed);
  if (Option.isSome(githubTree)) {
    return githubTree.value;
  }

  const gitUrl = yield* parseGitUrlFragment(trimmed);
  if (Option.isSome(gitUrl)) {
    return gitUrl.value;
  }

  if (looksLikeRemoteUrl(trimmed)) {
    return yield* new SourceParseError({
      input,
      reason:
        "Remote Git inputs must use a GitHub /tree/<ref>/<path> URL or a git URL fragment like <repo>#<ref>:<path>",
    });
  }

  return OkfSourceInput.cases.Local.make({
    input: trimmed,
    path: trimmed,
  });
});

const parseGitHubTreeUrl = Effect.fn("parseGitHubTreeUrl")(function* (
  input: string,
) {
  const url = yield* Schema.decodeUnknownEffect(Schema.URLFromString)(
    input,
  ).pipe(Effect.option);

  return yield* pipe(
    url,
    Option.filter((url) => url.hostname === "github.com"),
    Option.match({
      onNone: () => Effect.succeed(Option.none()),
      onSome: (url) =>
        Effect.gen(function* () {
          const parts = pipe(
            url.pathname,
            Str.split("/"),
            Arr.filter(Str.isNonEmpty),
          );
          const owner = Arr.get(parts, 0);
          const repo = Option.map(Arr.get(parts, 1), Str.replace(/\.git$/, ""));

          const marker = Arr.get(parts, 2);
          const ref = Arr.get(parts, 3);
          const subpath = pipe(parts, Arr.drop(4), Arr.join("/"));

          const source = Option.all({ owner, repo, marker, ref }).pipe(
            Option.filter(({ marker }) => marker === "tree"),
            Option.filter(() => Str.isNonEmpty(subpath)),
            Option.map(({ owner, repo, ref }) =>
              OkfSourceInput.cases.Git.make({
                input,
                ref,
                subpath,
                repoUrl: `https://github.com/${owner}/${repo}.git`,
              }),
            ),
          );

          return source;
        }),
    }),
  );
});

const parseGitUrlFragment = Effect.fn("parseGitUrlFragment")(function* (
  input: string,
) {
  return pipe(
    Option.fromNullishOr(gitFragmentPattern.exec(input)),
    Option.flatMap((match) =>
      Option.all({
        repoUrl: Arr.get(match, 1),
        ref: Arr.get(match, 2),
        subpath: Arr.get(match, 3),
      }),
    ),
    Option.filter(
      ({ repoUrl, ref, subpath }) =>
        looksLikeGitRepo(repoUrl) &&
        Str.isNonEmpty(ref) &&
        Str.isNonEmpty(subpath),
    ),
    Option.map(({ repoUrl, ref, subpath }) =>
      OkfSourceInput.cases.Git.make({
        input,
        repoUrl,
        ref,
        subpath,
      }),
    ),
  );
});

const looksLikeRemoteUrl = (input: string) =>
  /^https?:\/\//.test(input) || /^git@/.test(input);

const looksLikeGitRepo = (input: string) =>
  /^https?:\/\//.test(input) || /^git@/.test(input) || input.endsWith(".git");

export class SourceResolverConfig extends Context.Service<SourceResolverConfig>()(
  "@repo/SourceResolverConfig",
  {
    make: Effect.gen(function* () {
      const path = yield* Path.Path;
      const fs = yield* FileSystem.FileSystem;
      const configuredBaseDir = yield* Config.string(
        "OKF_SOURCE_BASE_DIR",
      ).pipe(Config.option);
      const baseDir = yield* pipe(
        configuredBaseDir,
        Option.match({
          onNone: () => findWorkspaceRoot(fs, path, globalThis.process.cwd()),
          onSome: Effect.succeed,
        }),
      );
      const configuredCacheRoot = yield* Config.string(
        "OKF_SOURCE_CACHE_DIR",
      ).pipe(Config.option);
      const cacheRoot = pipe(
        configuredCacheRoot,
        Option.getOrElse(() => path.join(baseDir, ".cache/okf-sources")),
      );

      return { baseDir, cacheRoot } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}

const findWorkspaceRoot = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  start: string,
) => {
  const search = (dir: string): Effect.Effect<string, unknown> =>
    Effect.gen(function* () {
      const packageJson = path.join(dir, "package.json");
      const exists = yield* fs.exists(packageJson);

      if (exists) {
        const content = yield* fs.readFileString(packageJson, "utf-8");
        const parsed = yield* Effect.try({
          try: () => JSON.parse(content) as { readonly workspaces?: unknown },
          catch: () => undefined,
        }).pipe(Effect.option);

        if (Option.isSome(parsed) && Array.isArray(parsed.value.workspaces)) {
          return dir;
        }
      }

      const parent = path.dirname(dir);
      return parent === dir ? start : yield* search(parent);
    });

  return search(path.resolve(start));
};

const cacheKey = (source: Extract<OkfSourceInput, { readonly _tag: "Git" }>) =>
  Buffer.from(`${source.repoUrl}#${source.ref}:${source.subpath}`)
    .toString("base64url")
    .slice(0, 80);

export class SourceResolver extends Context.Service<SourceResolver>()(
  "@repo/SourceResolver",
  {
    make: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const git = yield* GitService;
      const config = yield* SourceResolverConfig;

      const ensureDirectory = Effect.fn("ensureDirectory")(function* (
        input: string,
        dir: string,
      ) {
        const exists = yield* fs.exists(dir);
        if (!exists) {
          return yield* new SourceResolveError({
            input,
            reason: `Resolved bundle path does not exist: ${dir}`,
          });
        }

        const stat = yield* fs.stat(dir);
        if (stat.type !== "Directory") {
          return yield* new SourceResolveError({
            input,
            reason: `Resolved bundle path is not a directory: ${dir}`,
          });
        }
      });

      const resolveGit = Effect.fn("resolveGit")(function* (
        source: Extract<OkfSourceInput, { readonly _tag: "Git" }>,
      ) {
        const checkoutPath = path.join(
          config.cacheRoot,
          cacheKey(source),
          "repo",
        );
        const checkoutExists = yield* fs.exists(checkoutPath);

        if (!checkoutExists) {
          yield* fs.makeDirectory(path.dirname(checkoutPath), {
            recursive: true,
          });
          yield* git.clone({ ...source, checkoutPath });
        }

        const commit = yield* git
          .revParseHead(checkoutPath)
          .pipe(Effect.option);
        const bundlePath = path.join(checkoutPath, source.subpath);
        yield* ensureDirectory(source.input, bundlePath);

        return Schema.decodeSync(ResolvedOkfSource)({
          input: source.input,
          bundlePath,
          source,
          checkoutPath,
          ...(Option.isSome(commit) ? { commit: commit.value } : {}),
        });
      });

      const resolveLocalPath = (localPath: string) => {
        if (path.isAbsolute(localPath)) {
          return path.resolve(localPath);
        }

        return path.resolve(config.baseDir, localPath);
      };

      const resolveParsed = Effect.fn("resolveParsed")(function* (
        source: OkfSourceInput,
      ) {
        return yield* pipe(
          Match.value(source),
          Match.tag("Local", (source) =>
            Effect.gen(function* () {
              const localPath = source.path;
              const bundlePath = resolveLocalPath(localPath);
              yield* ensureDirectory(localPath, bundlePath);
              return Schema.decodeSync(ResolvedOkfSource)({
                input: localPath,
                bundlePath,
                source: { ...source, path: bundlePath },
              });
            }),
          ),
          Match.tag("Git", resolveGit),
          Match.exhaustive,
        );
      });

      return {
        parse: parseOkfSourceInput,
        resolve: Effect.fn("SourceResolver.resolve")(function* (input: string) {
          const parsed = yield* parseOkfSourceInput(input);
          return yield* resolveParsed(parsed);
        }),
        resolveParsed,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provideMerge(GitService.layer),
    Layer.provideMerge(SourceResolverConfig.layer),
  );
}
