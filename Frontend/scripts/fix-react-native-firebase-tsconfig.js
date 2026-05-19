const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'node_modules', 'tsconfig.packages.base.json');
const desiredContent = `${JSON.stringify({
  compilerOptions: {
    ignoreDeprecations: '6.0',
  },
}, null, 2)}\n`;

const packageTsconfigPaths = [
  path.join(__dirname, '..', 'node_modules', '@react-native-firebase', 'app', 'tsconfig.json'),
  path.join(__dirname, '..', 'node_modules', '@react-native-firebase', 'analytics', 'tsconfig.json'),
  path.join(__dirname, '..', 'node_modules', '@react-native-firebase', 'messaging', 'tsconfig.json'),
];

function patchPackageTsconfig(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const searchValue = `"compilerOptions": {\n    "baseUrl": ".",`;
  const replaceValue = `"compilerOptions": {\n    "ignoreDeprecations": "6.0",\n    "baseUrl": ".",`;

  const currentContent = fs.readFileSync(filePath, 'utf8');
  if (currentContent.includes('"ignoreDeprecations": "6.0"')) {
    return;
  }

  if (!currentContent.includes(searchValue)) {
    throw new Error(`Unexpected tsconfig shape: ${path.relative(process.cwd(), filePath)}`);
  }

  fs.writeFileSync(filePath, currentContent.replace(searchValue, replaceValue), 'utf8');
  console.log(`[postinstall] patched ${path.relative(process.cwd(), filePath)}`);
}

try {
  const currentContent = fs.existsSync(targetPath)
    ? fs.readFileSync(targetPath, 'utf8')
    : null;

  if (currentContent === desiredContent) {
    console.log('[postinstall] react-native-firebase tsconfig base already ensured');
  } else {
    fs.writeFileSync(targetPath, desiredContent, 'utf8');
    console.log('[postinstall] wrote node_modules/tsconfig.packages.base.json');
  }

  packageTsconfigPaths.forEach(patchPackageTsconfig);
} catch (error) {
  console.warn(
    '[postinstall] fix-react-native-firebase-tsconfig failed:',
    error && error.message ? error.message : String(error)
  );
  process.exitCode = 1;
}