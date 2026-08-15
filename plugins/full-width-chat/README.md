# `@yfzhou/dsh-full-width-chat`

Makes the DeepSeek Harness conversation use the full available content width instead of the default fixed-width column.

## Activate

```yaml
- insert:
    - id: full-width-chat
      name: '@yfzhou/dsh-full-width-chat'
```

## Runtime requirements

- Web client only
- Tested with DSH `0.1.0-rc.6`

The plugin overrides the current `--dsh-chat-content-width` shell variable and may need adjustment after a DSH UI update.

## License

MIT
