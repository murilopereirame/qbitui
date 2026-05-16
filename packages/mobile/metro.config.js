const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Watch the shared core package
const corePackagePath = path.resolve(__dirname, '../core');

config.watchFolders = [corePackagePath];

config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
];

config.resolver.extraNodeModules = {
  '@qbitui/core': path.resolve(corePackagePath, 'src'),
};

module.exports = config;
