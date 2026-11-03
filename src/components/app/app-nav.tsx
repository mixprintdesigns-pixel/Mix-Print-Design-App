import Link from "next/link";
import { Suspense } from "react";
import { logoutAction } from "@/app/actions/auth";
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon, YouTubeIcon } from "@/components/icons/social-icons";
import { getCurrentUser } from "@/lib/auth/session";
import { getSiteSettings, whatsappUrl } from "@/lib/content/site-settings";
import { AppTabBar, AppTabBarFallback, MoreRow } from "./app-tab-bar";

// App mode only: the bottom tab bar, with the account and social rows of its More sheet filled in on the server.

const icon = (path: string) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={path} />
  </svg>
);
const ICONS = {
  account: icon("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0"),
  dashboard: icon("M4 20V10M10 20V4M16 20v-7M22 20H2"),
  admin: icon(
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  ),
  signIn: icon("M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"),
  signOut: icon("M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"),
};

async function AccountRows() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <>
        <li>
          <Link href="/login" className="block hover:bg-background">
            <MoreRow icon={ICONS.signIn}>Sign in</MoreRow>
          </Link>
        </li>
        <li>
          <Link href="/affiliate/dashboard" className="block hover:bg-background">
            <MoreRow icon={ICONS.dashboard}>Affiliate dashboard</MoreRow>
          </Link>
        </li>
      </>
    );
  }
  return (
    <>
      <li>
        <Link href="/account" className="block hover:bg-background">
          <MoreRow icon={ICONS.account}>My account ({user.name.split(" ")[0]})</MoreRow>
        </Link>
      </li>
      <li>
        <Link href="/affiliate/dashboard" className="block hover:bg-background">
          <MoreRow icon={ICONS.dashboard}>Affiliate dashboard</MoreRow>
        </Link>
      </li>
      {(user.role === "ADMIN" || user.role === "STAFF") && (
        <li>
          <Link href="/admin" className="block hover:bg-background">
            <MoreRow icon={ICONS.admin}>Admin</MoreRow>
          </Link>
        </li>
      )}
      <li>
        <form action={logoutAction}>
          <button type="submit" className="block w-full text-left hover:bg-background">
            <MoreRow icon={ICONS.signOut}>Sign out</MoreRow>
          </button>
        </form>
      </li>
    </>
  );
}

async function SocialRows() {
  const settings = await getSiteSettings();
  const rows = [
    { href: whatsappUrl(settings), label: "Chat on WhatsApp", Icon: WhatsAppIcon },
    { href: settings.facebookUrl, label: "Facebook", Icon: FacebookIcon },
    { href: settings.instagramUrl, label: "Instagram", Icon: InstagramIcon },
    { href: settings.tiktokUrl, label: "TikTok", Icon: TikTokIcon },
    { href: settings.youtubeUrl, label: "YouTube", Icon: YouTubeIcon },
  ].filter((r) => r.href);
  return (
    <>
      {rows.map(({ href, label, Icon }) => (
        <li key={label}>
          <a href={href} target="_blank" rel="noopener noreferrer" className="block hover:bg-background">
            <MoreRow icon={<Icon className="h-6 w-6" />}>{label}</MoreRow>
          </a>
        </li>
      ))}
    </>
  );
}

/** Tiny WhatsApp button for the app's compact top bar (hidden on the normal website). */
export async function AppTopBarWhatsApp() {
  const settings = await getSiteSettings();
  return (
    <a
      href={whatsappUrl(settings)}
      target="_blank"
      rel="noopener noreferrer"
      className="hidden h-11 w-11 place-items-center rounded-full bg-green-600 text-white app:grid"
      aria-label="Chat on WhatsApp"
      data-testid="app-top-whatsapp"
    >
      <WhatsAppIcon className="h-6 w-6" />
    </a>
  );
}

export function AppNav() {
  // The tab bar reads the current address, so it streams in after the static page shell; until then the same
  // bar is shown without a highlighted tab, so it is never missing.
  return (
    <Suspense fallback={<AppTabBarFallback />}>
      <AppTabBar
        account={
          <Suspense fallback={<li className="h-14 animate-pulse" />}>
            <AccountRows />
          </Suspense>
        }
        social={
          <Suspense fallback={<li className="h-14 animate-pulse" />}>
            <SocialRows />
          </Suspense>
        }
      />
    </Suspense>
  );
}
