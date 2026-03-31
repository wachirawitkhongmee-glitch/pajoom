const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace Tailwind CDN script with output.css link
  content = content.replace(/<script\s+src="https:\/\/cdn\.tailwindcss\.com"><\/script>/gi, '<link rel="stylesheet" href="./output.css">');
  
  // Remove tailwind config injection scripts
  content = content.replace(/<script>\s*tailwind\.config\s*=\s*\{[\s\S]*?\}\s*<\/script>/gi, '');

  fs.writeFileSync(filePath, content);
  console.log('Fixed', file);
});
