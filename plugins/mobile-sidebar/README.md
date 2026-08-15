# `@yfzhou/dsh-mobile-sidebar`

A responsive navigation improvement for the DeepSeek Harness Web interface.

On screens up to 767 px wide, it hides the otherwise space-consuming collapsed sidebar rail and places a hamburger button at the far left of the conversation title row. Desktop sidebar behavior is unchanged.

## Activate

```yaml
- insert:
    - id: mobile-sidebar
      name: '@yfzhou/dsh-mobile-sidebar'
```

## Runtime requirements

- Client services: `layout`, `slots`
- Slot: `conversation.session.header.actions`
- Tested with DSH `0.1.0-rc.6`

The implementation relies on current DSH shell markup and CSS tokens, so verify it when upgrading DSH.

## License

MIT
