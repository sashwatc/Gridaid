# Full-window map workspace

The default citizen planner now uses the whole browser window. A compact header and status bar frame the satellite map; a left panel on desktop becomes a bottom drawer on smaller screens. The page stays fixed while the panel content scrolls. Plan, Results, Point and Info buttons select the relevant controls. The panel can be hidden, and the header has an optional browser fullscreen control with a recoverable unsupported-browser message.

Planning completion opens Results. Clicking a map point or suggested facility opens Point. Selecting cities or changing the drawn area returns to Plan and clears the previous result. Starting a drawing hides the panel so it does not block the gesture. The map fits the selected geography with room for the panels and keeps checked points visible as the layout changes. City selection, dragging/resizing/moving an area, scope-specific planning, road-route queries, errors and retries remain connected to FastAPI.

The large introductory headline, stacked marketing-style cards and gradients have been replaced with flat neutral surfaces, restrained blue accents, compact controls and a single scrolling panel. Dark/light preferences, imperial units, the research workspace and exact API values are preserved. Imagery attribution stays visible above the mobile toolbar rather than covering panel controls.

Calculation activity now uses up to 64 connected road walks instead of 16, with a faint solid network beneath the moving cyan traces. The walks follow saved road geometry. They remain illustrative activity rather than live solver telemetry or route results. The actual point route is drawn from the API response. Reduced motion still disables the movement, and cancellation/completion removes both activity layers and their SVG renderer.

Quad Cities planning continues to use Census population, directed roads and optimization. No incident ML model was trained or extended to Illinois by this UI change. The existing Iowa forecast remains separately labeled and precomputed.

## Verification

See the latest entry in [validation.md](validation.md) for executed commands and results. The browser suite includes whole-window dimensions and internal scrolling at 320–1440 px, hide/open and panel navigation, actual enter/exit fullscreen, denser road traces during a held real request, cancellation cleanup, drawing controls and the existing API-value, scope, routing, failure/retry, dark-mode, imperial, reduced-motion and research workflows. Raw screenshots and browser JSON are regenerated under ignored `artifacts/`.

This local browser verification does not establish universal browser support or operational emergency suitability. Satellite imagery still needs internet; saved roads remain the fallback.
