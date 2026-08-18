# Personal DSH presets

This directory contains trusted, personal [DeepSeek Harness (DSH)](https://www.npmjs.com/package/@deepseek-ai/dsh) agent presets. They are complete agent compositions, not npm plugins or profile bundle overlays.

Each preset directory contains:

- `agent.cordis.yml` — the Cordis composition mounted for the agent;
- `preset.yml` — optional display metadata.

User presets are discovered under `$DSH_HOME/.agent-presets`. The preset files are trusted composition code and should be treated like shell-capable configuration. This public repository intentionally contains only the portable preset source; it contains no server names, SSH aliases, credentials, or deployment scripts.

## Install locally

For a local checkout, make the DSH preset root point at this repository's preset directory:

```sh
ln -s /Users/yfzhou/code/dsh-plugin-gallery/presets ~/.dsh/.agent-presets
```

If `~/.dsh/.agent-presets` already exists as a directory, merge or remove it first after checking that it contains nothing you need to keep. Set the default separately in `~/.dsh/settings.yaml` when needed:

```yaml
agent-presets:
  default: standard-no-delegate
```

Remote deployments are intentionally managed separately. Copy the selected preset through your private deployment procedure or SSH workflow; do not add server-specific details to this public repository.

## Compatibility

Presets are full composition snapshots. Review them when upgrading DSH because host package names and composition contracts can change. New sessions pick up edits; running sessions keep the composition with which they were created.
