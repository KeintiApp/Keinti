const fs = require('fs');
const path = require('path');

function replaceExactlyOnce(content, searchValue, replaceValue, label) {
  const occurrences = content.split(searchValue).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${label}: expected exactly 1 occurrence, found ${occurrences}`);
  }
  return content.replace(searchValue, replaceValue);
}

function patchFile(targetPath, patches) {
  let content = fs.readFileSync(targetPath, 'utf8');
  let changed = false;

  for (const patch of patches) {
    if (content.includes(patch.after)) {
      continue;
    }

    content = replaceExactlyOnce(content, patch.before, patch.after, patch.label);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(targetPath, content, 'utf8');
    console.log(`[postinstall] patched ${path.relative(process.cwd(), targetPath)}`);
  } else {
    console.log(`[postinstall] already patched ${path.relative(process.cwd(), targetPath)}`);
  }
}

try {
  const targetPath = path.join(
    __dirname,
    '..',
    'node_modules',
    '@react-native',
    'community-cli-plugin',
    'dist',
    'commands',
    'start',
    'middleware.js'
  );

  patchFile(targetPath, [
    {
      label: 'Guard createDevServerMiddleware override',
      before: `  communityMiddlewareFallback.createDevServerMiddleware =
    communityCliServerApi.createDevServerMiddleware;
  communityMiddlewareFallback.indexPageMiddleware =
    communityCliServerApi.indexPageMiddleware;
`,
      after: `  if (typeof communityCliServerApi.createDevServerMiddleware === "function") {
    communityMiddlewareFallback.createDevServerMiddleware =
      communityCliServerApi.createDevServerMiddleware;
  }
  if (typeof communityCliServerApi.indexPageMiddleware === "function") {
    communityMiddlewareFallback.indexPageMiddleware =
      communityCliServerApi.indexPageMiddleware;
  }
`,
    },
  ]);
} catch (error) {
  console.warn(
    '[postinstall] fix-react-native-cli-middleware-compat failed:',
    error && error.message ? error.message : String(error)
  );
  process.exitCode = 1;
}