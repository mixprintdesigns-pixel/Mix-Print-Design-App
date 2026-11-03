"use client";

import { useSyncExternalStore } from "react";

// App mode = the site opened as the installed app (home-screen app, or the Play Store app / Trusted Web
// Activity). A tiny script in the root layout's <head> adds the "app-mode" class to <html> before the page
// paints, so app-only styles (the app: variant in globals.css) apply without a flash. It is switched on when:
// - the CSS display mode is standalone or fullscreen (the installed app), or
// - the page was opened by the Play Store app (Trusted Web Activity), or as an iPhone home-screen app, or
// - the address has ?app=1. The app's start address (manifest start_url) is /?app=1, so opening the app from
//   its home-screen icon always switches it on; it is remembered for the rest of the visit (sessionStorage).
// To preview the app look in a normal browser, open any page with ?app=1 (and ?app=0 to stop).
// globals.css also applies the app styles straight from the display-mode media query, as a second safety net.

export const APP_MODE_CLASS = "app-mode";
const PREVIEW_KEY = "mixprint:app-preview";
const CHANGE_EVENT = "mixprint:app-mode";

/** Runs in <head> before the page is shown. Kept tiny and dependency-free. */
export const APP_MODE_SCRIPT = `(function(){try{var d=document.documentElement,s=window.sessionStorage,q=new URLSearchParams(location.search).get("app");if(q==="1")s.setItem("${PREVIEW_KEY}","1");if(q==="0")s.removeItem("${PREVIEW_KEY}");var mm=function(v){return window.matchMedia?window.matchMedia("(display-mode: "+v+")"):null},l=[mm("standalone"),mm("fullscreen")],apply=function(){var on=s.getItem("${PREVIEW_KEY}")==="1"||navigator.standalone===true||document.referrer.indexOf("android-app://")===0||l.some(function(x){return x&&x.matches});if(on&&q!=="0")s.setItem("${PREVIEW_KEY}","1");d.classList.toggle("${APP_MODE_CLASS}",on);window.dispatchEvent(new Event("${CHANGE_EVENT}"))};apply();l.forEach(function(x){x&&x.addEventListener&&x.addEventListener("change",apply)})}catch(e){}})();`;

const subscribe = (onChange: () => void) => {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
};
const read = () => document.documentElement.classList.contains(APP_MODE_CLASS);

/** True when the page is shown as the installed app. Always false on the server. */
export function useAppMode(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
