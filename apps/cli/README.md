# OKF CLI

Command-line tools for validating, exploring, embedding, and querying Open
Knowledge Format bundles.

## Install from GitHub Packages

Configure the GitHub Packages npm registry for this scope:

```bash
npm config set @lloydrichards:registry https://npm.pkg.github.com
```

Install the CLI:

```bash
bun add -g @lloydrichards/edu_effect-okf
```

Run it:

```bash
okf --help
```

Use it against any local OKF bundle:

```bash
okf validate ./path/to/okf-bundle
okf graph ./path/to/okf-bundle
okf concept ./path/to/okf-bundle concept-id
```

The validation, graph, bundle, and concept commands work without API keys. The
`embed` and `query` commands also need a running ChromaDB instance and
`OPENAI_API_KEY`, because they create embeddings.

## Release

This package is released with Changesets. Add a changeset in feature PRs:

```bash
bun run changeset
```

Merging the generated release PR publishes the package to GitHub Packages.
