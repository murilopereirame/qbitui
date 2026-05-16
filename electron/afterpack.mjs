/**
 * electron-builder afterPack hook.
 *
 * Performs ad-hoc code signing on macOS app bundles when no Developer ID
 * certificate is available.  Without at least an ad-hoc signature, macOS
 * Gatekeeper quarantines downloaded builds and shows the misleading
 * "application is damaged" message.
 *
 * Ad-hoc signing (`codesign -s -`) does NOT satisfy Gatekeeper notarisation
 * requirements, but it prevents the "damaged" error and lets users open the
 * app via right-click → Open (or `xattr -cr /Applications/qbitUI.app`).
 */

import { execSync } from "child_process";
import path from "path";

/** @param {import("electron-builder").AfterPackContext} context */
export default async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  const productName = context.packager.appInfo.productName;
  const appBundle = path.join(context.appOutDir, `${productName}.app`);

  console.log(`[afterPack] Ad-hoc signing: ${appBundle}`);
  execSync(`codesign --deep --force --sign - "${appBundle}"`, {
    stdio: "inherit",
  });
}
