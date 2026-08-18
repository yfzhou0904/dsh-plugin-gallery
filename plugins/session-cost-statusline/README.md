# `@yfzhou/dsh-session-cost-statusline`

Adds an estimated session cost in CNY before the standard DSH composer
statistics. A durable host projection folds every logged request step and prices
each usage record using the model from its own request header, so totals replay
for existing sessions and stay correct across model switches. Usage from an
unrecognized model is omitted rather than priced with an unrelated fallback,
making the figure a lower-bound estimate, not billing authority.

## Install

```bash
dsh plugin --profile web add @yfzhou/dsh-session-cost-statusline
```

The package supplies its own DSH bundle row; do not add a separate
`cordis.patch.yml` entry.

## Pricing

Selected DeepSeek V4 and GPT-5.6 models are recognized; DeepSeek ids carrying a
build tag (e.g. `deepseek-v4-flash-ga-260731`) are normalized to their family.
DeepSeek V4 uses the published [time-of-day
schedule](https://api-docs.deepseek.com/zh-cn/quick_start/pricing) — peak is
09:00–12:00 and 14:00–18:00 Beijing, everything else off-peak. Per million
tokens (uncached input / cache-hit input / output):

| Model | Off-peak | Peak |
| --- | --- | --- |
| Flash | ¥1.50 / ¥0.05 / ¥4.50 | ¥3.00 / ¥0.10 / ¥9.00 |
| Pro | ¥4.50 / ¥0.15 / ¥13.50 | ¥9.00 / ¥0.30 / ¥27.00 |

Each request picks its bucket from its own start time and is never split across
a pricing boundary. Rates change; check the embedded table before relying on the
number.

Tested with DSH `0.1.0-rc.6`. Requires the `sessionProjections` host service,
the `slots` client service, and the `conversation.composer.dock` slot.

## License

MIT
