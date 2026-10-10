// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The website (web/, an Astro project with its own node_modules) shares the
// repo but is not part of the app bundle: keep Metro from crawling it.
const websiteDir = path.join(__dirname, 'web').replace(/[\\^$.*+?()[\]{}|/]/g, '\\$&');
const blockList = [].concat(config.resolver.blockList ?? []);
config.resolver.blockList = [...blockList, new RegExp(`^${websiteDir}[\\\\/].*`)];

module.exports = config;
