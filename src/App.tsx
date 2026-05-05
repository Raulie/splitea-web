import { Router, Route } from "@solidjs/router";
import { ItemsView } from "./views/ItemsView";
import { NotFound } from "./views/NotFound";

/// Top-level routing. The share link `splitea.app/r/<id>` is the
/// only meaningful path — ItemsView handles the SPA-internal
/// push to SavedReceiptView with its own state machine and the
/// OnsenUI iOS-slide animation; everything else falls through
/// to NotFound.
function App() {
  return (
    <Router>
      <Route path="/r/:shareID" component={ItemsView} />
      <Route path="*" component={NotFound} />
    </Router>
  );
}

export default App;
