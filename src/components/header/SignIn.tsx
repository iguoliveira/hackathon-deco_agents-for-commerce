import { Link } from "@tanstack/react-router";
import { useAuthAfterHydration } from "../../platform/user";
import Button from "../ui/Button";
import Icon from "../ui/Icon";

interface Props {
  variant: "mobile" | "desktop";
}

const MOBILE_ICON_CLASS =
  "tap-scale flex size-10 items-center justify-center rounded-sm text-ink transition-colors duration-(--duration-fast) hover:bg-white/60";

/**
 * Desktop renders the Figma "Action button" — plain text pill: "Account" or
 * "Login". Mobile has no room for a text pill next to the logo and cart, so
 * it renders an icon-only button matching the menu/search icons instead.
 */
function SignIn({ variant }: Props) {
  // `useAuthAfterHydration` e não `useUser`: este componente escolhe o href e o
  // texto do link, e `useUser` responde diferente no servidor e na primeira
  // renderização do cliente. Como o SignIn vive no header, a divergência
  // derrubava TODA página do site para quem estivesse logado. Ver o hook.
  const isAuthenticated = useAuthAfterHydration();
  const href = isAuthenticated ? "/account" : "/login";
  const label = isAuthenticated ? "Account" : "Login";

  if (variant === "mobile") {
    return (
      <Link to={href} aria-label={label} preload="intent" className={MOBILE_ICON_CLASS}>
        <Icon id="account_circle" size={18} />
      </Link>
    );
  }

  return (
    <Button href={href} size="md">
      {label}
    </Button>
  );
}

export default SignIn;
