/**
 * Đối chiếu tổng doanh thu / vốn / phí cố định / lợi nhuận cho khoảng ngày (string YYYY-MM-DD).
 * Dùng cùng logic getBillCostTotalsForReport như Reports.
 *
 * Chạy: node --env-file=.env scripts/analyze-week-cost-gap.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { getBillCostTotalsForReport } from '../src/utils/billCostTotals.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFallback() {
  try {
    const envPath = join(__dirname, '..', '.env');
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i === -1) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    /* ignore */
  }
}

loadEnvFallback();

const startDate = process.argv[2] || '2026-03-29';
const endDate = process.argv[3] || '2026-04-04';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('Thiếu VITE_FIREBASE_* trong .env hoặc môi trường.');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const billsSnap = await getDocs(
  query(
    collection(db, 'bills'),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'asc')
  )
);

const bills = billsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

const [menuSnap, orderSnap] = await Promise.all([
  getDocs(collection(db, 'menuItems')),
  getDocs(collection(db, 'orderItems')),
]);

const menuItems = menuSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
const orderItems = orderSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

let totalRevenue = 0;
let totalProfit = 0;
let totalCostDisp = 0;
let totalFixedDisp = 0;
const perBill = [];

for (const bill of bills) {
  const rev = Number(bill.totalRevenue) || 0;
  const prof = Number(bill.totalProfit) || 0;
  const { costPrice, fixedCost } = getBillCostTotalsForReport(
    bill,
    menuItems,
    orderItems
  );
  totalRevenue += rev;
  totalProfit += prof;
  totalCostDisp += costPrice;
  totalFixedDisp += fixedCost;
  const naiveProfit = rev - costPrice - fixedCost;
  const diff = naiveProfit - prof;
  const hasSnap =
    bill.totalCost != null &&
    bill.totalFixedCost != null &&
    Number.isFinite(Number(bill.totalCost)) &&
    Number.isFinite(Number(bill.totalFixedCost));

  perBill.push({
    idShort: bill.id.slice(-8),
    date: bill.date,
    rev,
    prof,
    cost: costPrice,
    fixed: fixedCost,
    naiveProfit,
    diff,
    source: hasSnap ? 'snapshot' : 'fallback',
  });
}

const gapTotal = totalRevenue - totalCostDisp - totalFixedDisp - totalProfit;

perBill.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

console.log(JSON.stringify({
  range: { startDate, endDate },
  billCount: bills.length,
  totals: {
    totalRevenue,
    totalCostDisplayed: totalCostDisp,
    totalFixedDisplayed: totalFixedDisp,
    totalProfitStored: totalProfit,
    revenueMinusCostMinusFixed: totalRevenue - totalCostDisp - totalFixedDisp,
    gapNaiveMinusStoredProfit: gapTotal,
  },
  snapshotBillCount: perBill.filter((r) => r.source === 'snapshot').length,
  fallbackBillCount: perBill.filter((r) => r.source === 'fallback').length,
  topBillsByAbsDiff: perBill.slice(0, 25),
}, null, 2));
