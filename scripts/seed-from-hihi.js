import fs from 'fs';
import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  query,
  where,
} from 'firebase/firestore';

/**
 * Import dữ liệu từ hihi.md → collection `dailyExpenses`.
 *
 * Cách dùng:
 *   - Dry-run (mặc định, in tóm tắt + cảnh báo, không ghi):
 *       node scripts/seed-from-hihi.js
 *   - Apply (ghi thật vào Firestore):
 *       node scripts/seed-from-hihi.js --apply
 *
 * Tuỳ chọn:
 *   --year=YYYY        Năm gắn cho các ngày D/M (mặc định: năm hiện tại)
 *   --file=PATH        File markdown (mặc định: hihi.md)
 *   --skip-existing    Bỏ qua ngày đã có dailyExpenses để không trùng lặp
 *
 * Mapping danh mục → kind:
 *   - Ốc, Món ăn, Sốt, Giải khát   → cogs
 *   - Nhân công                     → opex_variable
 *   - Chợ nhà                       → owner_draw  (KHÔNG tính vào CP quán)
 *   - Bán vàng                      → SKIP (báo cảnh báo, không import)
 *
 * Heuristic sửa typo tháng:
 *   - Khi parse "Ngày D/M" mà ngày tăng (D > prevDay) nhưng tháng nhảy đột ngột
 *     (M ≠ prevMonth) → coi là typo, fix về prevMonth.
 *     Ví dụ: ...11/1, 12/2, 13/1... → "12/2" được sửa thành "12/1".
 */

const CATEGORY_MAP = {
  'ốc': { kind: 'cogs', name: 'Nhập ốc' },
  'món ăn': { kind: 'cogs', name: 'Món ăn' },
  'sốt': { kind: 'cogs', name: 'Nước sốt' },
  'giải khát': { kind: 'cogs', name: 'Giải khát' },
  'nhân công': { kind: 'opex_variable', name: 'Nhân công' },
  'chợ nhà': { kind: 'owner_draw', name: 'Chợ nhà' },
  'ngân hàng': { kind: 'owner_draw', name: 'Đóng ngân hàng' },
};

const SKIP_CATEGORIES = new Set(['bán vàng']);

function parseArgs(argv) {
  const args = { apply: false, year: null, file: 'hihi.md', skipExisting: false, envPath: '.env' };
  for (const a of argv.slice(2)) {
    if (a === '--apply') args.apply = true;
    else if (a === '--skip-existing') args.skipExisting = true;
    else if (a.startsWith('--year=')) args.year = Number(a.slice('--year='.length));
    else if (a.startsWith('--file=')) args.file = a.slice('--file='.length);
    else if (a.startsWith('--env=')) args.envPath = a.slice('--env='.length);
  }
  if (!args.year) args.year = new Date().getFullYear();
  return args;
}

function loadEnv(path) {
  const result = dotenv.config({ path });
  if (result.error) {
    throw new Error(`Khong doc duoc file env: ${path}`);
  }
  return result.parsed || {};
}

function firebaseConfigFrom(env) {
  return {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function normalizeText(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Parse markdown thành danh sách phiếu chi:
 *   [{ year, month, day, dateRaw, items: [{ rawCat, amount, note }], dayTotal }]
 *
 * Áp dụng heuristic fix typo tháng dựa trên thứ tự xuất hiện (day phải tăng
 * dần trong cùng tháng; nếu day vẫn tăng mà month thay đổi → fix về prevMonth).
 */
function parseHihi(markdown, year) {
  const lines = markdown.split(/\r?\n/);
  const days = [];
  let current = null;
  let prevMonth = null;
  let prevDay = null;
  let typoFixes = [];

  const dayHeaderRe = /^\*\*Ng[àà]y\s+(\d{1,2})\s*\/\s*(\d{1,2})\*\*\s*$/i;
  const itemRe = /^-\s+([^:]+):\s*([\d.,]+)\s*(.*)$/;
  const totalRe = /^-\s*\*\*T[ổô]ng c[ộô]ng[^:]*:\s*([\d.,]+)\*\*/i;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;

    const headerMatch = line.match(dayHeaderRe);
    if (headerMatch) {
      let day = Number(headerMatch[1]);
      let month = Number(headerMatch[2]);
      const rawDate = `${day}/${month}`;

      // Heuristic fix typo:
      //   - Tháng chỉ đổi khi day "reset" (day mới < prevDay).
      //   - Nếu day không reset (>= prevDay) mà month khác prevMonth → typo, fix về prevMonth.
      // Ví dụ: ...1/1, 2/2, 3/1...  →  "2/2" được sửa thành "2/1".
      //         ...11/1, 12/2, 13/1... → "12/2" được sửa thành "12/1".
      if (prevMonth !== null) {
        const dayReset = day < prevDay; // chỉ true khi qua tháng mới thật sự
        const monthChanged = month !== prevMonth;
        if (!dayReset && monthChanged) {
          typoFixes.push({ raw: rawDate, fixed: `${day}/${prevMonth}` });
          month = prevMonth;
        }
      }

      current = {
        year,
        month,
        day,
        dateRaw: rawDate,
        date: `${year}-${pad2(month)}-${pad2(day)}`,
        items: [],
        dayTotal: null,
      };
      days.push(current);
      prevMonth = month;
      prevDay = day;
      continue;
    }

    if (!current) continue;

    // Tổng cộng line
    const totalMatch = line.match(totalRe);
    if (totalMatch) {
      const v = Number(totalMatch[1].replace(/[.,]/g, ''));
      current.dayTotal = v;
      continue;
    }

    // Item line
    const itemMatch = line.match(itemRe);
    if (itemMatch) {
      const rawCat = itemMatch[1].trim();
      const amountStr = itemMatch[2].replace(/[.,]/g, '');
      const amount = Number(amountStr);
      const note = (itemMatch[3] || '').trim();
      if (Number.isFinite(amount) && amount > 0) {
        current.items.push({ rawCat, amount, note });
      }
    }
  }

  return { days, typoFixes };
}

async function main() {
  const args = parseArgs(process.argv);

  const filePath = args.file;
  if (!fs.existsSync(filePath)) {
    throw new Error(`Khong tim thay file: ${filePath}`);
  }
  const md = fs.readFileSync(filePath, 'utf8');

  const env = loadEnv(args.envPath);
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error(`Thieu VITE_FIREBASE_PROJECT_ID trong ${args.envPath}`);
  }
  const app = initializeApp(firebaseConfigFrom(env), 'seed-from-hihi');
  const db = getFirestore(app);

  const { days, typoFixes } = parseHihi(md, args.year);

  console.log('=== SEED FROM HIHI.MD ===');
  console.log(`Env:     ${args.envPath}`);
  console.log(`Project: ${projectId}`);
  console.log(`File:    ${filePath}`);
  console.log(`Year:    ${args.year}`);
  console.log(`Mode:    ${args.apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Days:    ${days.length}`);
  if (typoFixes.length > 0) {
    console.log('');
    console.log('Heuristic fix typo thang (auto):');
    for (const f of typoFixes) {
      console.log(`  Ngay ${f.raw}  ->  Ngay ${f.fixed}`);
    }
  }
  console.log('');

  // Lấy danh mục từ Firestore (đã seed bằng seed-expense-categories.js)
  let catSnap;
  try {
    catSnap = await getDocs(collection(db, 'expenseCategories'));
  } catch (err) {
    if (err && err.code === 'permission-denied') {
      console.error('');
      console.error('LOI: Permission denied khi doc expenseCategories.');
      console.error('Co the do firestore.rules MOI chua duoc deploy len Firebase.');
      console.error('Chay lenh sau de deploy:');
      console.error('  firebase deploy --only firestore:rules');
      console.error('Hoac vao Firebase Console > Firestore > Rules de copy-paste tu file firestore.rules.');
      process.exit(3);
    }
    throw err;
  }
  const categoriesByName = new Map();
  catSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.name) categoriesByName.set(normalizeText(data.name), { id: d.id, ...data });
  });

  if (categoriesByName.size === 0) {
    console.error('LOI: Chua co danh muc trong expenseCategories.');
    console.error('Hay chay truoc: npm run seed:expense-categories -- --apply');
    process.exit(2);
  }

  // Map mỗi rawCat → category trong DB
  function resolveCategory(rawCat) {
    const normRaw = normalizeText(rawCat);
    if (SKIP_CATEGORIES.has(normRaw)) {
      return { skip: true, reason: 'skip_list' };
    }
    const map = CATEGORY_MAP[normRaw];
    if (!map) {
      return { skip: true, reason: 'unmapped' };
    }
    const cat = categoriesByName.get(normalizeText(map.name));
    if (!cat) {
      return { skip: true, reason: `category_not_found:${map.name}` };
    }
    if (cat.kind !== map.kind) {
      // Cảnh báo nếu kind trong DB khác với mapping
      return {
        cat,
        warning: `kind_mismatch: DB=${cat.kind} expected=${map.kind}`,
      };
    }
    return { cat };
  }

  // Đếm rawCat & cảnh báo
  const rawCatStats = new Map();
  for (const d of days) {
    for (const it of d.items) {
      const k = normalizeText(it.rawCat);
      const cur = rawCatStats.get(k) || { count: 0, totalAmount: 0, sample: it.rawCat };
      cur.count += 1;
      cur.totalAmount += it.amount;
      rawCatStats.set(k, cur);
    }
  }

  console.log('Tom tat danh muc thay trong file:');
  const sortedStats = [...rawCatStats.entries()].sort((a, b) => b[1].totalAmount - a[1].totalAmount);
  for (const [, s] of sortedStats) {
    const r = resolveCategory(s.sample);
    let tag;
    if (r.skip) tag = `SKIP (${r.reason})`;
    else if (r.warning) tag = `MAP -> ${r.cat.name} [${r.cat.kind}] (warn: ${r.warning})`;
    else tag = `MAP -> ${r.cat.name} [${r.cat.kind}]`;
    console.log(`  ${s.sample.padEnd(14)} | ngay=${String(s.count).padStart(3)} | tong=${s.totalAmount.toLocaleString('vi-VN').padStart(10)} | ${tag}`);
  }
  console.log('');

  // Tổng hợp số liệu sẽ ghi
  let totalRows = 0;
  let totalAmount = 0;
  let skippedRows = 0;
  let skippedAmount = 0;
  const dateGroups = new Map(); // date -> [{ kind, categoryId, amount, note }]

  for (const d of days) {
    for (const it of d.items) {
      const r = resolveCategory(it.rawCat);
      if (r.skip) {
        skippedRows += 1;
        skippedAmount += it.amount;
        continue;
      }
      const cat = r.cat;
      const arr = dateGroups.get(d.date) || [];
      arr.push({
        date: d.date,
        kind: cat.kind,
        categoryId: cat.id,
        amount: it.amount,
        note: `[hihi.md ${d.dateRaw}] ${it.note || it.rawCat}`,
      });
      dateGroups.set(d.date, arr);
      totalRows += 1;
      totalAmount += it.amount;
    }
  }

  console.log('Du kien ghi:');
  console.log(`  So ngay co data:   ${dateGroups.size}`);
  console.log(`  So dong se ghi:    ${totalRows}`);
  console.log(`  Tong amount ghi:   ${totalAmount.toLocaleString('vi-VN')}`);
  console.log(`  So dong bo qua:    ${skippedRows} (tong ${skippedAmount.toLocaleString('vi-VN')})`);
  console.log('');

  if (!args.apply) {
    console.log('Day la DRY-RUN, chua ghi du lieu.');
    console.log('Chay lai voi --apply de ghi that:');
    console.log(`  node scripts/seed-from-hihi.js --apply --year=${args.year}`);
    console.log('Them --skip-existing de bo qua nhung ngay da co dailyExpenses.');
    process.exit(0);
  }

  // APPLY: Ghi thật, theo từng ngày
  const allDates = [...dateGroups.keys()].sort();
  let writtenRows = 0;
  let skippedDays = 0;

  for (const date of allDates) {
    if (args.skipExisting) {
      const existQ = query(collection(db, 'dailyExpenses'), where('date', '==', date));
      const existSnap = await getDocs(existQ);
      if (!existSnap.empty) {
        console.log(`SKIP day ${date} (da co ${existSnap.size} dong)`);
        skippedDays += 1;
        continue;
      }
    }

    const rows = dateGroups.get(date);
    for (const r of rows) {
      await addDoc(collection(db, 'dailyExpenses'), {
        date: r.date,
        kind: r.kind,
        categoryId: r.categoryId,
        amount: r.amount*1000,
        note: r.note,
        createdAt: new Date(),
        importedFrom: 'hihi.md',
      });
      writtenRows += 1;
    }
    process.stdout.write(`OK ${date} (${rows.length} dong)\r`);
  }
  process.stdout.write('\n');

  console.log('');
  console.log('=== KET QUA APPLY ===');
  console.log(`Da ghi:      ${writtenRows} dong`);
  console.log(`Bo qua ngay: ${skippedDays}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Script loi:', err);
  process.exit(1);
});
