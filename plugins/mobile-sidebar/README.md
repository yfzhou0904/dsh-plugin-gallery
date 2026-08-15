# `@yfzhou/dsh-mobile-sidebar`

A responsive navigation improvement for the DeepSeek Harness Web interface.

On screens up to 767 px wide, it hides the otherwise space-consuming collapsed sidebar rail and places DSH's native sidebar toggle at the top left of the shell. The control remains available on both active conversations and the new-session screen. Desktop sidebar behavior is unchanged.

## Activate

```yaml
- insert:
    - id: mobile-sidebar
      name: '@yfzhou/dsh-mobile-sidebar'
```

## Runtime requirements

- Client services: `layout`, `slots`
- Slot: `shell.overlay`
- UI primitive: `IconPanelLeftOutline16` from `@deepseek-ai/dsh-client-ui-primitives`
- Tested with DSH `0.1.0-rc.6`

The implementation relies on current DSH shell markup and CSS tokens, so verify it when upgrading DSH.

## License

MIT
