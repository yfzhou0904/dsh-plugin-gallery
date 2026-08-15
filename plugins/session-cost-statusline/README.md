# `@yfzhou/dsh-session-cost-statusline`

Adds an estimated session cost in CNY before the standard DeepSeek Harness composer statistics.

The estimate uses cumulative token projections and an embedded model-rate table. It currently recognizes selected DeepSeek V4 and GPT-5.6 models. Unknown models fall back to the DeepSeek V4 Flash rate, so this is an operational estimate rather than billing authority.

## Activate

```yaml
- insert:
    - id: session-cost-statusline
      name: '@yfzhou/dsh-session-cost-statusline'
```

## Runtime requirements

- Client service: `slots`
- Slot: `conversation.composer.dock`
- Tested with DSH `0.1.0-rc.6`

Pricing changes over time. Review the embedded rate table before relying on the displayed amount.

## License

MIT
