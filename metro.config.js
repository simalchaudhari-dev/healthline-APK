const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// babel-plugin-lucide-direct imports single icon files (lucide-react-native/dist/esm/icons/x.js).
// The package does not list those paths in its "exports", so Metro would print a warning per icon;
// resolve them straight to the file instead.
const LUCIDE_PREFIX = 'lucide-react-native/dist/';
const lucideRoot = path.join(__dirname, 'node_modules', 'lucide-react-native');
const upstreamResolve = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith(LUCIDE_PREFIX)) {
    return { type: 'sourceFile', filePath: path.join(lucideRoot, moduleName.slice('lucide-react-native/'.length)) };
  }
  return upstreamResolve
    ? upstreamResolve(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
