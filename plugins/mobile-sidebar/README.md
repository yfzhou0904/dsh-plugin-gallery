# `@yfzhou/dsh-mobile-sidebar`

On screens up to 767 px wide, hides the space-consuming collapsed sidebar rail
and puts DSH's native sidebar toggle at the top left of the shell instead. The
control is available on both active conversations and the new-session screen,
and desktop behavior is unchanged.

## Install

```bash
dsh plugin --profile web add @yfzhou/dsh-mobile-sidebar
```

The package supplies its own DSH bundle row; do not add a separate
`cordis.patch.yml` entry. Refresh the browser after installing.

Tested with DSH `0.1.0-rc.6`; it depends on current shell markup and CSS
tokens, so re-check it when upgrading DSH.

## License

MIT
