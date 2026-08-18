# `@yfzhou/dsh-full-width-chat`

Makes the DSH conversation use the full available content width instead of the
default fixed-width column, by overriding the shell's
`--dsh-chat-content-width` variable.

## Install

```bash
dsh plugin --profile web add @yfzhou/dsh-full-width-chat
```

The package supplies its own DSH bundle row; do not add a separate
`cordis.patch.yml` entry. Refresh the browser after installing.

Tested with DSH `0.1.0-rc.6`; the width variable may be renamed by a DSH UI
update.

## License

MIT
