import { Router, Route } from "@solidjs/router";
import { ItemsView } from "./views/ItemsView";
import { NotFound } from "./views/NotFound";

/// Top-level routing.
///
/// Web is intentionally **read-only** — it exists so a
/// recipient of a share link can see their split without
/// installing anything. Everything else (profile management,
/// avatar upload, payment-username editing, contact directory
/// lookups) lives in the iOS app. Visitors landing on any
/// non-share path get the "download Splitea" CTA via NotFound.
///
///   - `/r/<shareID>` — the share-receipt landing page. Drives
///     the SPA-internal push to SavedReceiptView with the
///     OnsenUI-style iOS slide.
///   - everything else → NotFound (App Store nudge).
function App() {
  return (
    <Router>
      <Route path="/r/:shareID" component={ItemsView} />
      <Route path="*" component={NotFound} />
    </Router>
  );
}

export default App;
