---
name: iOS bounce/scroll fix for Capacitor
description: Root cause and correct fix for WebView elastic bounce scroll and home-indicator nav gap on iOS.
---

## The problem
With `contentInset: "automatic"` (Capacitor default), iOS shifts the CSS coordinate system so that CSS `bottom: 0` ends ~34 px above the physical screen edge. Our web layer cannot reach that zone at all — no CSS `env()` trick closes the gap because the coordinate system itself is offset.

Separately, without any scroll prevention, the WKWebView body bounces/elastic-scrolls and reveals background strips at top and bottom.

## The correct native fix (requires Xcode rebuild)

**`capacitor.config.ts`**: Change `contentInset: "never"` so the WebView fills the full physical screen.

**`client/src/index.css`**: Clamp the native `#root` from the safe status-bar edge to the physical bottom, then all absolute children land in the right place automatically. Because the base root uses `height: 100dvh`, the native override must set `height: auto` (and `min-height: 0`) so fixed `top`/`bottom` constraints determine the height:

```css
html, body { overscroll-behavior: none; }

 #root {
  position: fixed;
  top: env(safe-area-inset-top, 0px);
  bottom: 0;
  left: env(safe-area-inset-left, 0px);
  right: env(safe-area-inset-right, 0px);
  height: auto;
  min-height: 0;
  overflow: hidden;
}

:root { --nav-bottom: 5rem; }
```

**Home layout rule**: The nav pane remains exactly `5rem` tall and is anchored with `bottom: 0`. On native, keep the pane background at that fixed height, remove parent safe-area padding, and size only its inner control row to `calc(5rem - env(safe-area-inset-bottom))`; content panels use matching `bottom: 5rem`.

**Why**: `contentInset: "never"` makes CSS `bottom: 0` = physical screen bottom. The root begins below the status bar and fills to the physical bottom. Adding the safe-area inset to the nav height moves the nav top upward and creates a visibly oversized second bottom band; padding the fixed pane clips the labels. Keeping the background on the pane and constraining only the inner row preserves both edge alignment and label visibility.

**After changing capacitor.config.ts**: run `npx cap sync ios` then rebuild in Xcode. Also re-run the objectVersion sed fix (see ios-cocoapods-objectversion.md) after cap sync.

## What was tried and failed
- `overflow: hidden` on html/body → breaks contentInset:automatic, content appears behind status bar
- `overscroll-behavior: none` only → body still bounces
- `position: fixed; inset: 0` on #root with contentInset:automatic → #root extends to physical edges but CSS bottom:0 for absolute children is still 34px above screen edge; adding `paddingBottom: env()` to nav created a visible filled "bar"
- Lifting nav by `bottom: env(safe-area-inset-bottom)` → nav floats above screen edge with background gap visible below it
- All env() approaches with contentInset:automatic → env() returns 0 or wrong values because the coordinate system is already shifted by the native layer
- Keeping a base `height: 100dvh` alongside native fixed `top`/`bottom` constraints → the root extends below the visible viewport and clips the bottom navigation
- Clamping the root's bottom to `env(safe-area-inset-bottom)` → leaves the entire bottom safe-area region as a visible gap below the nav pane
