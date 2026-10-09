import { renderToString } from "solid-js/web";
import Landing from "./views/landing/Landing";
import { LANDING_LOCALES, copyFor, pathFor, registerCopy } from "./views/landing/locales";
import es from "./views/landing/copy/es";
import ptBR from "./views/landing/copy/pt-BR";
import fr from "./views/landing/copy/fr";
import de from "./views/landing/copy/de";
import it from "./views/landing/copy/it";
import ja from "./views/landing/copy/ja";
import ko from "./views/landing/copy/ko";
import zhHans from "./views/landing/copy/zh-Hans";
import zhHant from "./views/landing/copy/zh-Hant";

registerCopy("es", es);
registerCopy("pt-BR", ptBR);
registerCopy("fr", fr);
registerCopy("de", de);
registerCopy("it", it);
registerCopy("ja", ja);
registerCopy("ko", ko);
registerCopy("zh-Hans", zhHans);
registerCopy("zh-Hant", zhHant);

export const landingPages = LANDING_LOCALES.map((l) => ({
  code: l.code,
  seg: l.seg,
  hreflang: l.hreflang,
  og: l.og,
  path: pathFor(l),
  meta: copyFor(l.code).meta,
  hero: { titleTop: copyFor(l.code).hero.titleTop, titleBottom: copyFor(l.code).hero.titleBottom, pills: copyFor(l.code).hero.pills },
}));

export const renderLanding = (seg: string) => renderToString(() => <Landing lang={seg} />);
