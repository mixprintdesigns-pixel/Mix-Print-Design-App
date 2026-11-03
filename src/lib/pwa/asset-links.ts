// Digital Asset Links for the Android app (Trusted Web Activity), served at /.well-known/assetlinks.json.
// It proves the app on Google Play belongs to this website, so the app opens full screen without a browser bar.
// Set in Vercel → Settings → Environment Variables:
//   TWA_PACKAGE_NAME          e.g. com.mixprintdesign.app
//   TWA_SHA256_FINGERPRINTS   one or more SHA-256 certificate fingerprints, comma separated
// While either is empty, the list is empty.

export function assetLinks(env: Record<string, string | undefined> = process.env) {
  const packageName = env.TWA_PACKAGE_NAME?.trim();
  const fingerprints = (env.TWA_SHA256_FINGERPRINTS ?? "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter((f) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f));
  if (!packageName || fingerprints.length === 0) return [];
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: packageName, sha256_cert_fingerprints: fingerprints },
    },
  ];
}
