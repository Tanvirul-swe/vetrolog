import fs from 'node:fs';
import path from 'node:path';

const docsDir = path.resolve('src/content/docs');

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (file.endsWith('.md') && file !== 'index.md') {
      processMarkdownFile(fullPath);
    }
  }
}

function processMarkdownFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // If already has frontmatter with title, skip title extraction
  let title = '';
  if (!content.startsWith('---')) {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
      // Remove the top # Title line from content so it doesn't duplicate Starlight's h1
      content = content.replace(/^#\s+.+$/m, '').trimStart();
    } else {
      title = path.basename(filePath, '.md');
    }

    content = `---\ntitle: "${title.replace(/"/g, '\\"')}"\n---\n\n${content}`;
  }

  // Convert GitBook hints to Starlight asides
  content = content.replace(/\{%\s*hint style="info"\s*%\}/g, ':::note');
  content = content.replace(/\{%\s*hint style="success"\s*%\}/g, ':::tip');
  content = content.replace(/\{%\s*hint style="warning"\s*%\}/g, ':::caution');
  content = content.replace(/\{%\s*hint style="danger"\s*%\}/g, ':::danger');
  content = content.replace(/\{%\s*endhint\s*%\}/g, ':::');

  // Convert image paths to /vetrolog/assets/...
  content = content.replace(/\.\.\/\.gitbook\/assets\//g, '/vetrolog/assets/');
  content = content.replace(/\.gitbook\/assets\//g, '/vetrolog/assets/');
  content = content.replace(/\.\.\/assets\//g, '/vetrolog/assets/');

  // Convert intra-doc links (.md -> clean URL with trailing slash)
  // e.g. [Quick Start](getting-started/quickstart.md) -> [Quick Start](/vetrolog/getting-started/quickstart/)
  content = content.replace(/\]\((?!https?:\/\/)([^)#]+)\.md(#?[^)]*)\)/g, (match, p1, p2) => {
    let target = p1;
    if (target.startsWith('../')) {
      target = target.replace(/^\.\.\//, '');
    } else if (target.startsWith('./')) {
      target = target.replace(/^\.\//, '');
    }
    // If target is just a relative file without folder prefix, resolve based on relative path if needed
    if (!target.startsWith('/')) {
      // Keep simple relative link or absolute base
      return `](/vetrolog/${target}/${p2})`;
    }
    return `](/vetrolog${target}/${p2})`;
  });

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Processed: ${path.relative(docsDir, filePath)} -> Title: "${title}"`);
}

processDirectory(docsDir);
console.log('Finished formatting all markdown files for Starlight!');
