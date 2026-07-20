// build-manifest.js
// Run `node build-manifest.js` from project root to regenerate manifest.json
const fs = require('fs');
const path = require('path');

const root = __dirname;
// scan inside `Subject` directory for topic folders
const SUBJECT_DIR = path.join(root, 'Subject');
const ignore = new Set(['index.html','index.css','script.js','README.md','questions_sample.txt','.git','manifest.json','build-manifest.js']);

function normalizeLabel(filename){
  // filename like nursing_history_student_friday_4.txt -> take first two words
  const base = filename.replace(/\.txt$/i,'');
  const parts = base.split(/[_\-]+/).filter(Boolean);
  if(parts.length === 0) return base;
  // use up to first three words for a clearer label (e.g. "Adult Learner Student")
  const labelParts = parts.slice(0,3).map(p => p.charAt(0).toUpperCase() + p.slice(1));
  const suffix = parts.length > 3 && /^\d+$/.test(parts[parts.length - 1]) ? ` ${parts[parts.length - 1]}` : '';
  return labelParts.join(' ') + suffix;
}

function scan(){
  const topics = {};
  if(!fs.existsSync(SUBJECT_DIR)) return topics;
  const items = fs.readdirSync(SUBJECT_DIR, { withFileTypes:true });
  items.forEach(dirent => {
    if(dirent.isDirectory()){
      const name = dirent.name;
      const dirPath = path.join(SUBJECT_DIR, name);
      const files = fs.readdirSync(dirPath).filter(f => /\.txt$/i.test(f));
      topics[name] = files.map(f => {
        const filepath = path.join(dirPath, f);
        let content = '';
        try{ content = fs.readFileSync(filepath, 'utf8'); }catch(e){ content = ''; }
        return ({ filename: f, path: path.posix.join('Subject', name, f), label: normalizeLabel(f), content });
      });
    }
  });
  return topics;
}

const topics = scan();
fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify({ topics }, null, 2));
console.log('manifest.json written. Topics:', Object.keys(topics));
// Also inline manifest into index.html's <script id="embedded-manifest"> if present
try{
  const indexPath = path.join(root, 'index.html');
  let indexHtml = fs.readFileSync(indexPath, 'utf8');
  const manifestString = JSON.stringify({ topics }, null, 2).replace(/</g,'\\u003c');
  const embedScript = `        <script id="embedded-manifest">\n          window.__MANIFEST__ = ${manifestString};\n        </script>`;
  if(indexHtml.includes('id="embedded-manifest"')){
    // replace existing <script id="embedded-manifest">...<\/script>
    indexHtml = indexHtml.replace(/<script id="embedded-manifest">[\s\S]*?<\/script>/, embedScript);
    fs.writeFileSync(indexPath, indexHtml, 'utf8');
    console.log('Embedded manifest injected into index.html');
  }
}catch(e){
  console.warn('Could not inline manifest into index.html:', e.message);
}
