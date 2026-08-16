# DSH Touch Tooltips

Suppresses DSH's hover/focus tooltip bubbles on touch devices.

## The problem

DSH's `Tooltip` component (from `@deepseek-ai/dsh-client-ui-primitives`) shows a
bubble on `mouseenter` and `focus`, and only hides it on `mouseleave` or
`blur`. On a phone, tapping a button fires a *synthetic* `mouseenter` plus
`focus`, so the bubble appears — but nothing ever fires `mouseleave`/`blur`
unless you tap empty space. The result is a tooltip that lingers on screen
after the button has already done its job.

## The fix

Tooltips are a hover affordance and carry no meaning on a touchscreen, so this
plugin simply hides them on coarse-pointer devices:

```css
@media (pointer: coarse) {
  [role="tooltip"] {
    display: none !important;
  }
}
```

The anchor's accessible name is still exposed to assistive technology, so
accessibility is unaffected. Desktop hover tooltips are left untouched.

## Install

```sh
dsh plugin --profile web add @yfzhou/dsh-touch-tooltips
```

For local development:

```sh
dsh plugin --profile web add ./plugins/touch-tooltips
```

Browser plugins require a page refresh after first installation or upgrade.

## Compatibility

Targets DSH `0.1.0-rc.6`. It patches `role="tooltip"` elements, so it keeps
working as long as DSH renders tooltip bubbles with that role.
