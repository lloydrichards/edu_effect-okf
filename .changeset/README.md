# Changesets

Add a changeset in each PR that should release the CLI:

```bash
bun run changeset
```

The release workflow opens a version PR. Merging that PR publishes changed
packages to GitHub Packages.
