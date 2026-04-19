import fs from 'fs';

const filePath = 'bills-training.json';

const bills = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Đếm số bill theo từng ngày
const countByDate = {};

for (const bill of bills) {
  const date = bill.createdAt
    ? bill.createdAt.slice(0, 10) // lấy YYYY-MM-DD
    : 'unknown';

  countByDate[date] = (countByDate[date] ?? 0) + 1;
}

// Sort ngày giảm dần
const sorted = Object.entries(countByDate).sort((a, b) => b[0].localeCompare(a[0]));

console.log('\n📅 Số bill theo từng ngày (giảm dần)\n');
console.log('Ngày            | Số bill');
console.log('----------------|--------');

let total = 0;
for (const [date, count] of sorted) {
  console.log(`${date.padEnd(16)}| ${count}`);
  total += count;
}

console.log('----------------|--------');
console.log(`${'TỔNG'.padEnd(16)}| ${total}`);
console.log();
