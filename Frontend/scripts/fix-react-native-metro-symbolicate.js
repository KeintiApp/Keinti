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
  const candidatePaths = [
    path.join(
      __dirname,
      '..',
      'node_modules',
      '@react-native',
      'community-cli-plugin',
      'node_modules',
      'metro',
      'src',
      'Server.js'
    ),
    path.join(
      __dirname,
      '..',
      'node_modules',
      '@react-native',
      'metro-config',
      'node_modules',
      'metro',
      'src',
      'Server.js'
    ),
  ];

  const existingPaths = candidatePaths.filter((targetPath) => fs.existsSync(targetPath));

  if (existingPaths.length === 0) {
    throw new Error('metro Server.js not found in expected node_modules locations');
  }

  for (const targetPath of existingPaths) {
    patchFile(targetPath, [
      {
        label: 'Guard Metro symbolicate body parsing',
        before: `      const body = await req.rawBody;
      const parsedBody = JSON.parse(body);
      const rewriteAndNormalizeStackFrame = (frame, lineNumber) => {
`,
        after: `      const rawBody = await req.rawBody;
      const body =
        typeof rawBody === "string"
          ? rawBody
          : Buffer.isBuffer(rawBody)
            ? rawBody.toString("utf8")
            : "";
      if (body.trim().length === 0) {
        debug("Skipping symbolication request with empty body");
        res.end(
          JSON.stringify({
            codeFrame: null,
            stack: [],
          })
        );
        process.nextTick(() => {
          log(createActionEndEntry(symbolicatingLogEntry));
        });
        return;
      }
      let parsedBody;
      try {
        parsedBody = JSON.parse(body);
      } catch (error) {
        debug("Skipping symbolication request with invalid JSON body");
        res.end(
          JSON.stringify({
            codeFrame: null,
            stack: [],
          })
        );
        process.nextTick(() => {
          log(createActionEndEntry(symbolicatingLogEntry));
        });
        return;
      }
      if (!Array.isArray(parsedBody.stack)) {
        debug("Skipping symbolication request without stack array");
        res.end(
          JSON.stringify({
            codeFrame: null,
            stack: [],
          })
        );
        process.nextTick(() => {
          log(createActionEndEntry(symbolicatingLogEntry));
        });
        return;
      }
      const rewriteAndNormalizeStackFrame = (frame, lineNumber) => {
`,
      },
    ]);
  }
} catch (error) {
  console.warn(
    '[postinstall] fix-react-native-metro-symbolicate failed:',
    error && error.message ? error.message : String(error)
  );
  process.exitCode = 1;
}