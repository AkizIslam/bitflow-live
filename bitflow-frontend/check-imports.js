const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');

function getAllFiles(dir, files = []) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, files);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      files.push(fullPath);
    }
  });
  return files;
}

function checkImportCase(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const importRegex = /import\s+.*?\s+from\s+['"](.*?)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];

    // Skip node_modules imports
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) continue;

    const resolvedPath = path.resolve(path.dirname(filePath), importPath);
    let actualPath = '';
    try {
      actualPath = fs.existsSync(resolvedPath + '.js')
        ? resolvedPath + '.js'
        : fs.existsSync(resolvedPath + '.jsx')
        ? resolvedPath + '.jsx'
        : fs.existsSync(resolvedPath)
        ? resolvedPath
        : null;
    } catch {}
    if (!actualPath) continue;

    const parts = resolvedPath.split(path.sep);
    const actualParts = actualPath.split(path.sep);

    for (let i = 0; i < Math.min(parts.length, actualParts.length); i++) {
      if (parts[i] !== actualParts[i]) {
        console.log(
          `Case mismatch in file: ${filePath}\n  Import: ${importPath}\n  Actual: ${actualParts
            .slice(i)
            .join(path.sep)}\n`
        );
        break;
      }
    }
  }
}

// Run for all files
const allFiles = getAllFiles(SRC_DIR);
allFiles.forEach(checkImportCase);
