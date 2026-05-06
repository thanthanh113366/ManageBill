import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  setDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';

/**
 * Seed danh mục mặc định + pnlSettings/default cho module Quản lý vốn & P&L.
 *
 * Cách chạy:
 *   - Dry-run (mặc định, chỉ in ra sẽ tạo gì):
 *       node scripts/seed-expense-categories.js
 *   - Apply (ghi thật vào Firestore):
 *       node scripts/seed-expense-categories.js --apply
 *
 * Script đọc Firebase config từ file .env (cùng pattern với scripts/seed-test-sanitized-data.js).
 */

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

const DEFAULT_CATEGORIES = [
  // COGS - giá vốn hàng bán (đi chợ) — khớp với 4 nhóm trong hihi.md + nhóm phụ
  { name: 'Ốc',       kind: 'cogs',          color: '#0ea5e9', order: 1, active: true },
  { name: 'Món ăn',   kind: 'cogs',          color: '#22c55e', order: 2, active: true },
  { name: 'Sốt',      kind: 'cogs',          color: '#f59e0b', order: 3, active: true },
  { name: 'Giải khát', kind: 'cogs',         color: '#a855f7', order: 4, active: true },
  { name: 'Hải sản',  kind: 'cogs',          color: '#06b6d4', order: 5, active: true },
  { name: 'Thịt',     kind: 'cogs',          color: '#ef4444', order: 6, active: true },
  { name: 'Rau củ',   kind: 'cogs',          color: '#84cc16', order: 7, active: true },
  { name: 'Gia vị',   kind: 'cogs',          color: '#eab308', order: 8, active: true },
  { name: 'Khác (vốn)', kind: 'cogs',        color: '#94a3b8', order: 9, active: true },

  // OPEX biến đổi - chi phí biến đổi theo ngày
  { name: 'Nhân công',     kind: 'opex_variable', color: '#fb923c', order: 10, active: true },
  { name: 'Gas',           kind: 'opex_variable', color: '#f97316', order: 11, active: true },
  { name: 'Đá',            kind: 'opex_variable', color: '#38bdf8', order: 12, active: true },
  { name: 'Túi nilon / Hộp', kind: 'opex_variable', color: '#a3e635', order: 13, active: true },
  { name: 'Vận chuyển',    kind: 'opex_variable', color: '#f472b6', order: 14, active: true },

  // OPEX cố định - chi phí cố định tháng (chỉ làm reference; chi phí thực nhập ở monthlyFixedCosts)
  { name: 'Lương cố định',  kind: 'opex_fixed', color: '#6366f1', order: 20, active: true },
  { name: 'Mặt bằng',       kind: 'opex_fixed', color: '#0f172a', order: 21, active: true },
  { name: 'Internet / Điện cố định', kind: 'opex_fixed', color: '#14b8a6', order: 22, active: true },
  { name: 'Khấu hao thiết bị', kind: 'opex_fixed', color: '#64748b', order: 23, active: true },

  // Owner Draw - rút vốn chủ (chợ nhà, chi tiêu cá nhân) — KHÔNG tính vào CP quán
  { name: 'Chợ nhà',        kind: 'owner_draw', color: '#78716c', order: 30, active: true },
  { name: 'Chi tiêu cá nhân khác', kind: 'owner_draw', color: '#a8a29e', order: 31, active: true },
];

const DEFAULT_PNL_SETTINGS = {
  taxRate: 0,                    // % tổng (0..100)
  taxMode: 'on_profit_before_tax', // 'on_revenue' | 'on_profit_before_tax'
  depreciationMonthly: 0,        // số tiền khấu hao/dự phòng tháng
  otherReservePercent: 0,        // % dự phòng/hao hụt trên doanh thu (0..100)
  useTheoreticalCost: true,      // hiển thị cột so sánh P&L lý thuyết
};

async function readCollection(db, name) {
  const snap = await getDocs(collection(db, name));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function main() {
  const argList = process.argv.slice(2);
  const args = new Set(argList);
  const dryRun = !args.has('--apply');
  // Cho phép chọn env file: --env=.env.development.local
  const envArg = argList.find((a) => a.startsWith('--env='));
  const envPath = envArg ? envArg.slice('--env='.length) : '.env';

  const env = loadEnv(envPath);
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error('Thieu VITE_FIREBASE_PROJECT_ID trong .env');
  }

  const app = initializeApp(firebaseConfigFrom(env), 'seed-expense-categories');
  const db = getFirestore(app);

  console.log('=== SEED EXPENSE CATEGORIES & PNL SETTINGS ===');
  console.log(`Env:     ${envPath}`);
  console.log(`Project: ${projectId}`);
  console.log(`Mode:    ${dryRun ? 'DRY-RUN' : 'APPLY'}`);
  console.log('');

  // Kiểm tra danh mục đã có
  const existing = await readCollection(db, 'expenseCategories');
  const existingByName = new Map(
    existing.map((c) => [String(c.name || '').trim().toLowerCase(), c])
  );

  let createCount = 0;
  let skipCount = 0;

  for (const cat of DEFAULT_CATEGORIES) {
    const key = cat.name.trim().toLowerCase();
    if (existingByName.has(key)) {
      console.log(`SKIP   ${cat.kind.padEnd(14)} ${cat.name} (da ton tai)`);
      skipCount += 1;
      continue;
    }
    if (dryRun) {
      console.log(`CREATE ${cat.kind.padEnd(14)} ${cat.name}`);
    } else {
      await addDoc(collection(db, 'expenseCategories'), {
        ...cat,
        createdAt: serverTimestamp(),
      });
      console.log(`OK     ${cat.kind.padEnd(14)} ${cat.name}`);
    }
    createCount += 1;
  }

  // pnlSettings/default - chỉ tạo nếu chưa có để không ghi đè cấu hình user
  const settingsDocs = await readCollection(db, 'pnlSettings');
  const hasDefault = settingsDocs.some((d) => d.id === 'default');
  if (hasDefault) {
    console.log('SKIP   pnlSettings/default (da ton tai)');
  } else if (dryRun) {
    console.log('CREATE pnlSettings/default', DEFAULT_PNL_SETTINGS);
  } else {
    await setDoc(doc(db, 'pnlSettings', 'default'), {
      ...DEFAULT_PNL_SETTINGS,
      updatedAt: serverTimestamp(),
    });
    console.log('OK     pnlSettings/default');
  }

  console.log('');
  console.log('=== KET QUA ===');
  console.log(`Categories: tao moi=${createCount}, bo qua=${skipCount}`);
  if (dryRun) {
    console.log('');
    console.log('Day la DRY-RUN, chua ghi du lieu.');
    console.log('Chay lai voi --apply de ghi that:');
    console.log('  node scripts/seed-expense-categories.js --apply');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Script loi:', err.message);
  process.exit(1);
});
