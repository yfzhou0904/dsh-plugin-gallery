# `@yfzhou/dsh-touch-tooltips`

On a phone, tapping a button fires synthetic `mouseenter`/`focus` but never
`mouseleave`/`blur`, so a DSH tooltip appears and then lingers on screen until
you tap empty space. Tooltips are a hover affordance and carry no meaning on a
touchscreen, so this plugin hides `[role="tooltip"]` elements under
`@media (pointer: coarse)`. The anchor's accessible name is still exposed to
assistive technology, and desktop hover tooltips are untouched.

## Install

```bash
dsh plugin --profile web add @yfzhou/dsh-touch-tooltips
```

The package supplies its own DSH bundle row; do not add a separate
`cordis.patch.yml` entry. Refresh the browser after installing.

Tested with DSH `0.1.0-rc.6`; it keeps working as long as DSH renders tooltip
bubbles with `role="tooltip"`.

## License

MIT
