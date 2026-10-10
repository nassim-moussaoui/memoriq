// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The website (web/, an Astro project with its own node_modules) shares the
// repo but is not part of the app bundle: keep Metro from crawling and
// watching it. Metro tests this pattern against both native and POSIX
// paths (its fallback watcher on Windows converts to forward slashes), so
// every separator matches either "\" or "/".
const escape = (s) => s.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
const websitePattern = path
  .join(__dirname, 'web')
  .split(/[\\/]/)
  .map(escape)
  .join('[\\\\/]');
const blockList = [].concat(config.resolver.blockList ?? []);
config.resolver.blockList = [...blockList, new RegExp(`^${websitePattern}([\\\\/].*)?$`)];

module.exports = config;
