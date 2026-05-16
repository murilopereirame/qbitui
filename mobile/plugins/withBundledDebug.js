const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Forces the React Native Gradle plugin to bundle JS even for the debug
 * variant by clearing `debuggableVariants`.
 *
 * By default the RN Gradle plugin lists "debug" (and "debugOptimized") as
 * debuggable variants, which skips JS bundling so the app loads its bundle
 * from a Metro server at runtime.  Setting `debuggableVariants = []` makes
 * every variant — including debug — go through the normal bundle + Hermes
 * compilation step, so the resulting APK works without a running Metro server
 * while still being a debug build (adb logs, debuggable flag, etc.).
 */
const withBundledDebug = (config) =>
  withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /(?:\/\/\s*)?debuggableVariants\s*=\s*\[[^\]]*\]/,
      'debuggableVariants = []',
    );
    return cfg;
  });

module.exports = withBundledDebug;
