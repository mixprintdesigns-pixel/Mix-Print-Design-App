"use client";

import { useSyncExternalStore } from "react";

// App mode = the site opened as the installed app (home-screen app, or the Play Store app / Trusted Web
// Activity), detected with the CSS display-mode media query. A tiny script in the root layout's <head> adds the
// "app-mode" class to <html> before the page paints, so app-only styles (the app: variant in globals.css) apply
// without a flash. To preview the app look in a normal browser, open any page with ?app=1 (and ?app=0 to stop).

export const APP_MODE_CLASS = "app-mode";
const PREVIEW_KEY = "mixprint:app-preview";

/** Runs in <head> before the page is shown. Kept tiny and dependency-free. */
export const APP_MODE_SCRIPT = `(function(){try{var d=document.documentElement,q=new URLSearchParams(location.search).get("app");if(q==="1")sessionStorage.setItem("${PREVIEW_KEY}","1");if(q==="0")sessionStorage.removeItem("${PREVIEW_KEY}");var m=function(v){return window.matchMedia&&window.matchMedia("(display-mode: "+v+")").matches};if(m("standalone")||m("fullscreen")||sessionStorage.getItem("${PREVIEW_KEY}")==="1")d.classList.add("${APP_MODE_CLASS}")}catch(e){}})();`;

const subscribe = () => () => {};
const read = () => document.documentElement.classList.contains(APP_MODE_CLASS);

/** True when the page is shown as the installed app. Always false on the server. */
export function useAppMode(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
