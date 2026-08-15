# `@yfzhou/dsh-session-cost-statusline`

Adds an estimated session cost in CNY before the standard DeepSeek Harness composer statistics.

The estimate uses cumulative token projections and an embedded model-rate table. It currently recognizes selected DeepSeek V4 and GPT-5.6 models. Unknown models fall back to the DeepSeek V4 Flash rate, so this is an operational estimate rather than billing authority.

## Install

```bash
dsh plugin --profile web add @yfzhou/dsh-session-cost-statusline
```

The package supplies its own DSH bundle row; do not add a separate `cordis.patch.yml` entry.

## Runtime requirements

- Client service: `slots`
- Slot: `conversation.composer.dock`
- Tested with DSH `0.1.0-rc.6`

The embedded DeepSeek V4 rates are fixed CNY midpoint estimates between the published peak and off-peak prices (Flash: ¥2.25/¥0.08/¥6.75; Pro: ¥6.75/¥0.23/¥20.25 per million input-miss/cache-hit/output tokens), based on the [DeepSeek pricing documentation](https://api-docs.deepseek.com/zh-cn/quick_start/pricing). The statusline intentionally does not distinguish time of day. It uses the latest model provenance to price cumulative usage; if no model is available or the model is not in the rate table, it omits the cost rather than applying a fallback. Pricing changes over time; review the embedded rate table before relying on the displayed amount.

## License

MIT
