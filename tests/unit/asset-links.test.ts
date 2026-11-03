import { describe, expect, it } from "vitest";
import { assetLinks } from "@/lib/pwa/asset-links";

const FP = "AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89";

describe("Digital Asset Links (Android app)", () => {
  it("is an empty list until the package name and fingerprint are set", () => {
    expect(assetLinks({})).toEqual([]);
    expect(assetLinks({ TWA_PACKAGE_NAME: "com.mixprintdesign.app" })).toEqual([]);
    expect(assetLinks({ TWA_PACKAGE_NAME: "", TWA_SHA256_FINGERPRINTS: FP })).toEqual([]);
  });

  it("lists the app with every valid fingerprint (comma separated, any case)", () => {
    expect(assetLinks({ TWA_PACKAGE_NAME: " com.mixprintdesign.app ", TWA_SHA256_FINGERPRINTS: `${FP.toLowerCase()}, not-a-fingerprint ,${FP.replace(/^AB/, "CD")}` })).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: { namespace: "android_app", package_name: "com.mixprintdesign.app", sha256_cert_fingerprints: [FP, FP.replace(/^AB/, "CD")] },
      },
    ]);
  });
});
