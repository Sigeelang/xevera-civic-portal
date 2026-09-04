const fs = require('fs');
const path = require('path');

const srcDir = 'src';
const files = [];
function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (f.endsWith('.jsx') || f.endsWith('.js')) files.push(full);
  });
}
walk(srcDir);

const errors = [];
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const imports = content.matchAll(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
  for (const m of imports) {
    let imp = m[1];
    if (imp.startsWith('.') || imp.startsWith('/')) {
      let resolved;
      if (imp.startsWith('.')) {
        resolved = path.resolve(path.dirname(f), imp);
      } else {
        resolved = path.resolve(srcDir, imp);
      }
      const exts = ['.jsx', '.js'];
      let found = false;
      for (const ext of exts) {
        if (fs.existsSync(resolved + ext)) {
          found = true;
          break;
        }
      }
      if (!found && !fs.existsSync(resolved)) {
        errors.push({ file: f, import: imp, resolved });
      }
    }
  }
});

errors.forEach(e => console.log(e.file + ' -> ' + e.import + ' (resolved: ' + e.resolved + ')'));
console.log('Total import errors: ' + errors.length);
