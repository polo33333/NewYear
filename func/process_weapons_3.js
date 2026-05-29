const fs = require('fs');
const file = 'data-local/weapons_local.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const representatives = {};
const finalData = [];

for (const w of data) {
    if (w.rank < 4) {
        const key = `${w.typeid}_${w.rank}`;
        if (!representatives[key]) {
            w.name = `${w.rank}★ ${w.type}`;
            representatives[key] = w;
            finalData.push(w);
        }
    } else {
        finalData.push(w);
    }
}

fs.writeFileSync(file, JSON.stringify(finalData, null, 2), 'utf8');
console.log(`Processed. Before: ${data.length}, After: ${finalData.length}`);
