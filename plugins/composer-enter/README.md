# `@yfzhou/dsh-composer-enter`

Changes the DSH composer keyboard behavior:

- **Enter** inserts a newline.
- **Cmd+Enter** submits on macOS.
- **Ctrl+Enter** submits on Windows/Linux and is also useful on mobile keyboards that expose a control modifier.
- **Shift+Enter** remains DSH's native behavior.

The plugin intercepts only plain Enter in the conversation textarea. Cmd/Ctrl+Enter is left to DSH's own keyboard handler so submission continues through the normal session-aware path. It is client-only and has no host-side behavior.

## Install

```bash
dsh plugin --profile web add @yfzhou/dsh-composer-enter
```

The package supplies its own DSH bundle row; do not add a separate `cordis.patch.yml` entry.

## Runtime requirements

- Web client only
- Tested with DSH `0.1.0-rc.6`

The plugin relies on the conversation composer slot's current DOM structure and may need adjustment after a DSH UI update.

## License

MIT
