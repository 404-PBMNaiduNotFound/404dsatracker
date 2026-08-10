const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            if (!file.includes('node_modules') && !file.includes('.git') && !file.includes('.next')) {
                results = results.concat(walk(file));
            }
        } else {
            if (/\.(tsx|ts|html|json|md|js)$/.test(file)) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('c:/Users/bhanu/OneDrive/Desktop/ca');
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let newContent = content.replace(/DSA⁴⁰⁴/g, 'DSA⁴⁰⁴')
                            .replace(/DSA4\uFFFD4/g, 'DSA⁴⁰⁴')
                            .replace(/DSA⁴⁰⁴/g, 'DSA⁴⁰⁴');
    if (content !== newContent) {
        fs.writeFileSync(file, newContent, 'utf8');
    }
});
