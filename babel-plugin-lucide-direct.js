/**
 * Rewrites `import { Bell, X as Close } from 'lucide-react-native'` into one import per icon file:
 *   import Bell from 'lucide-react-native/dist/esm/icons/bell.js'
 *
 * Why: the package entry re-exports ~1,700 icons, and Metro does not tree-shake, so every bundle
 * (dev and release) carried all of them — about half of the app's modules — which made the first
 * `expo start` bundle take ~2 minutes. Only the icons the app uses are bundled now.
 *
 * The name → file map is read from the package's own entry file, so new lucide versions and icon
 * aliases (LineChart, BellIcon, LucideBell …) keep working. Anything not in the map (namespace
 * imports, types, unknown names) leaves the import untouched.
 */
const fs = require('fs');
const path = require('path');

const PKG = 'lucide-react-native';
let cachedMap = null;

function iconMap() {
  if (cachedMap) return cachedMap;
  cachedMap = new Map();
  try {
    // The package does not export package.json, so resolve its main file and walk up to the folder.
    let pkgDir = path.dirname(require.resolve(PKG));
    while (path.basename(pkgDir) !== PKG && path.dirname(pkgDir) !== pkgDir) pkgDir = path.dirname(pkgDir);
    const entry = fs.readFileSync(path.join(pkgDir, 'dist', 'esm', 'lucide-react-native.js'), 'utf8');
    const re = /export\s*\{([^}]+)\}\s*from\s*'\.\/([^']+)'/g;
    let m;
    while ((m = re.exec(entry))) {
      const file = m[2];
      m[1].split(',').forEach((part) => {
        const alias = part.trim().match(/^default\s+as\s+(\w+)$/);
        if (alias) cachedMap.set(alias[1], `${PKG}/dist/esm/${file}`);
      });
    }
  } catch {
    // Unknown layout: keep imports as they are (slower bundle, still correct).
    cachedMap = new Map();
  }
  return cachedMap;
}

module.exports = function lucideDirect({ types: t }) {
  return {
    name: 'lucide-direct-imports',
    visitor: {
      ImportDeclaration(p) {
        const node = p.node;
        if (node.source.value !== PKG || node.importKind === 'type') return;
        const map = iconMap();
        const specs = node.specifiers;
        if (!specs.length) return;
        const allMapped = specs.every(
          (s) => t.isImportSpecifier(s) && s.importKind !== 'type' && map.has(s.imported.name || s.imported.value),
        );
        if (!allMapped) return;
        p.replaceWithMultiple(
          specs.map((s) =>
            t.importDeclaration(
              [t.importDefaultSpecifier(t.identifier(s.local.name))],
              t.stringLiteral(map.get(s.imported.name || s.imported.value)),
            ),
          ),
        );
      },
    },
  };
};
