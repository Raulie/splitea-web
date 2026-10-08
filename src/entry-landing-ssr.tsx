import { renderToString } from "solid-js/web";
import Landing from "./views/landing/Landing";

export const renderLanding = () => renderToString(() => <Landing />);
