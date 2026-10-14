// Metro configuration for the Pluto mobile app living inside an npm-workspaces
// monorepo.
//
// Two things break without this file:
//   1. Workspace packages (`packages/*`) are never watched, so edits there do
//      not trigger a rebuild.
//   2. npm hoists most dependencies to the repo root, while a few that conflict
//      with `apps/web` (react, react-dom, scheduler) stay in
//      `apps/mobile/node_modules`. Metro must look in both.
//
// See https://docs.expo.dev/guides/monorepos/ for the upstream pattern.

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// 1. Watch the whole workspace so shared packages hot-reload.
config.watchFolders = [workspaceRoot];

// 2. Resolve from the app first (nested overrides), then the hoisted root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// With explicit nodeModulesPaths, hierarchical lookup walks parent directories
// and can pick up a second copy of react from the root. Disable it so each
// import resolves to exactly one package.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
