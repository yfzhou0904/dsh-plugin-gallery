# `@yfzhou/dsh-full-width-chat`

Makes the DeepSeek Harness conversation use the full available content width instead of the default fixed-width column.

## Install

```bash
dsh plugin --profile web add @yfzhou/dsh-full-width-chat
```

The package supplies its own DSH bundle row; do not add a separate `cordis.patch.yml` entry.

## Runtime requirements

- Web client only
- Tested with DSH `0.1.0-rc.6`

The plugin overrides the current `--dsh-chat-content-width` shell variable and may need adjustment after a DSH UI update.

## License

MIT
