import { getBillCostTotalsForReport } from './billCostTotals';

/**
 * Module công thức P&L theo chuẩn nhà hàng (single source of truth).
 *
 * Khái niệm:
 *   - Doanh thu (Revenue)        = sum(bills.totalRevenue) trong kỳ
 *   - COGS thực tế (đi chợ)      = sum(dailyExpenses where kind='cogs')
 *   - COGS lý thuyết (theo menu) = sum(billCost theo menuItem.costPrice)
 *   - OPEX biến đổi              = sum(dailyExpenses where kind='opex_variable')
 *   - OPEX cố định (phân bổ)     = sum theo tháng giao kỳ:
 *       monthlyFixedCosts.amount * (số_ngày_kỳ_trong_tháng / số_ngày_tháng_đó)
 *   - Khấu hao phân bổ           = depreciationMonthly * (ngày_trong_kỳ / 30)
 *   - Rút vốn chủ (Owner Draw)   = sum(dailyExpenses where kind='owner_draw')
 *       → Chợ nhà / chi tiêu cá nhân của chủ. KHÔNG phải chi phí của quán,
 *         không trừ vào lợi nhuận. Chỉ trừ ra ở dòng "Lợi nhuận giữ lại".
 *
 *   - Lợi nhuận gộp        = Revenue − COGS thực tế
 *   - Lợi nhuận ròng (EBT) = Gross − OPEX biến đổi − OPEX cố định − Khấu hao
 *   - Thuế:
 *       on_revenue:           Revenue * taxRate%
 *       on_profit_before_tax: max(0, EBT) * taxRate%
 *   - Lợi nhuận thực  = EBT − Thuế − Revenue * otherReservePercent%
 *   - Lợi nhuận giữ lại (Retained) = Lợi nhuận thực − Rút vốn chủ
 *
 *   - Chênh lệch vốn = COGS thực tế − COGS lý thuyết (>0 là hao hụt / mua dư)
 */

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Sinh danh sách các ngày 'YYYY-MM-DD' trong khoảng [from, to] (inclusive).
 */
export const enumerateDates = (from, to) => {
  if (!from || !to) return [];
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (end < start) return [];
  const out = [];
  const cur = new Date(start);
  while (cur <= end) {
    out.push(`${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}-${pad2(cur.getDate())}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
};

/**
 * Số ngày trong tháng 'YYYY-MM'.
 */
export const daysInMonth = (yearMonth) => {
  if (!yearMonth) return 30;
  const [y, m] = yearMonth.split('-').map(Number);
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate();
};

/**
 * Phân bổ một dòng monthlyFixedCosts ({ month, amount }) về các ngày trong [from, to].
 * Trả về { perDay: amountPerDay, daysInRange: số ngày của tháng đó nằm trong kỳ }.
 */
export const allocateMonthlyToRange = (entry, from, to) => {
  const month = entry?.month;
  if (!month) return { perDay: 0, daysInRange: 0 };
  const total = toNumber(entry.amount);
  if (total <= 0) return { perDay: 0, daysInRange: 0 };

  const dim = daysInMonth(month);
  const perDay = total / dim;

  const [y, m] = month.split('-').map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m - 1, dim);

  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);

  const overlapStart = monthStart > start ? monthStart : start;
  const overlapEnd = monthEnd < end ? monthEnd : end;

  if (overlapEnd < overlapStart) {
    return { perDay, daysInRange: 0 };
  }

  const ms = overlapEnd - overlapStart;
  const days = Math.round(ms / (1000 * 60 * 60 * 24)) + 1;

  return { perDay, daysInRange: days };
};

const computeTax = (revenue, ebt, settings) => {
  const rate = toNumber(settings?.taxRate) / 100;
  if (rate <= 0) return 0;
  if (settings?.taxMode === 'on_revenue') {
    return Math.max(0, revenue) * rate;
  }
  return Math.max(0, ebt) * rate;
};

const emptyKpi = () => ({
  revenue: 0,
  cogsActual: 0,
  cogsTheoretical: 0,
  opexVariable: 0,
  opexFixed: 0,
  depreciation: 0,
  ownerDraw: 0,
  grossProfit: 0,
  grossMargin: 0,
  netOperatingProfit: 0,
  tax: 0,
  reserve: 0,
  netIncome: 0,
  retainedProfit: 0,
  costVariance: 0,
  bills: 0,
});

/**
 * Tính P&L cho toàn bộ kỳ + breakdown theo từng ngày + theo từng category.
 *
 * @param {object} args
 * @param {Array} args.bills              - các bill trong kỳ ({ date, totalRevenue, totalCost?, totalFixedCost?, items })
 * @param {Array} args.dailyExpenses      - các phiếu chi trong kỳ ({ date, kind, categoryId, amount })
 * @param {Array} args.monthlyFixedCosts  - các dòng cố định tháng giao với kỳ ({ month, categoryId, amount })
 * @param {Array} args.menuItems          - cho COGS lý thuyết
 * @param {Array} args.orderItems         - cho COGS lý thuyết
 * @param {Array} args.expenseCategories  - để gắn name/color vào breakdown
 * @param {object} args.settings          - pnlSettings/default
 * @param {string} args.from              - 'YYYY-MM-DD'
 * @param {string} args.to                - 'YYYY-MM-DD'
 * @returns {object} kết quả P&L
 */
export const computePnL = ({
  bills = [],
  dailyExpenses = [],
  monthlyFixedCosts = [],
  menuItems = [],
  orderItems = [],
  expenseCategories = [],
  settings = {},
  from,
  to,
}) => {
  const dates = enumerateDates(from, to);
  const daysCount = dates.length || 1;

  // index theo date + kind
  const byDayMap = new Map();
  for (const d of dates) {
    byDayMap.set(d, {
      date: d,
      ...emptyKpi(),
      bills: 0,
    });
  }

  // 1) Doanh thu + COGS lý thuyết theo ngày
  for (const bill of bills) {
    const d = bill?.date;
    if (!d) continue;
    const row = byDayMap.get(d) || { date: d, ...emptyKpi() };
    if (!byDayMap.has(d)) byDayMap.set(d, row);

    row.revenue += toNumber(bill.totalRevenue);
    row.bills += 1;

    const { costPrice } = getBillCostTotalsForReport(bill, menuItems, orderItems);
    row.cogsTheoretical += toNumber(costPrice);
  }

  // 2) Chi phí ngày (đi chợ + biến đổi) theo ngày + theo category
  const categoryMap = new Map();
  const ensureCat = (id, kindFromExpense) => {
    if (!id) {
      const fallbackId = `__none_${kindFromExpense || 'unknown'}__`;
      if (!categoryMap.has(fallbackId)) {
        categoryMap.set(fallbackId, {
          id: fallbackId,
          name: 'Không phân loại',
          kind: kindFromExpense || 'cogs',
          color: '#94a3b8',
          amount: 0,
        });
      }
      return categoryMap.get(fallbackId);
    }
    if (!categoryMap.has(id)) {
      const meta = expenseCategories.find((c) => c.id === id) || {};
      categoryMap.set(id, {
        id,
        name: meta.name || 'Khác',
        kind: meta.kind || kindFromExpense || 'cogs',
        color: meta.color || '#94a3b8',
        amount: 0,
      });
    }
    return categoryMap.get(id);
  };

  for (const exp of dailyExpenses) {
    const d = exp?.date;
    const amount = toNumber(exp?.amount);
    if (!d || amount <= 0) continue;
    const row = byDayMap.get(d) || { date: d, ...emptyKpi() };
    if (!byDayMap.has(d)) byDayMap.set(d, row);

    const kind = exp.kind || 'cogs';
    if (kind === 'cogs') {
      row.cogsActual += amount;
    } else if (kind === 'opex_variable') {
      row.opexVariable += amount;
    } else if (kind === 'opex_fixed') {
      // hiếm: nếu user gán nhầm fixed vào dailyExpenses → vẫn gộp vào opexFixed ngày
      row.opexFixed += amount;
    } else if (kind === 'owner_draw') {
      // Rút vốn chủ — không tính vào chi phí quán, hạch toán sau lợi nhuận thực
      row.ownerDraw += amount;
    }

    const cat = ensureCat(exp.categoryId, kind);
    cat.amount += amount;
  }

  // 3) Phân bổ chi phí cố định tháng về từng ngày trong kỳ
  for (const entry of monthlyFixedCosts) {
    const { perDay, daysInRange } = allocateMonthlyToRange(entry, from, to);
    if (perDay <= 0 || daysInRange <= 0) continue;

    const month = entry.month;
    const [yy, mm] = month.split('-').map(Number);
    const dim = daysInMonth(month);
    for (let day = 1; day <= dim; day += 1) {
      const dateStr = `${yy}-${pad2(mm)}-${pad2(day)}`;
      if (!byDayMap.has(dateStr)) continue;
      const row = byDayMap.get(dateStr);
      row.opexFixed += perDay;
    }

    // Bổ sung vào breakdown category
    if (entry.categoryId) {
      const cat = ensureCat(entry.categoryId, 'opex_fixed');
      cat.amount += perDay * daysInRange;
    }
  }

  // 4) Khấu hao phân bổ theo ngày trong kỳ (depreciationMonthly / 30)
  const depreciationPerDay = toNumber(settings?.depreciationMonthly) / 30;
  if (depreciationPerDay > 0) {
    for (const row of byDayMap.values()) {
      row.depreciation += depreciationPerDay;
    }
  }

  // 5) Tính phái sinh cho từng ngày
  const reservePct = toNumber(settings?.otherReservePercent) / 100;
  const byDay = Array.from(byDayMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => {
      const grossProfit = row.revenue - row.cogsActual;
      const grossMargin = row.revenue > 0 ? grossProfit / row.revenue : 0;
      const ebt =
        grossProfit - row.opexVariable - row.opexFixed - row.depreciation;
      const tax = computeTax(row.revenue, ebt, settings);
      const reserve = Math.max(0, row.revenue) * reservePct;
      const netIncome = ebt - tax - reserve;
      const retainedProfit = netIncome - row.ownerDraw;
      const costVariance = row.cogsActual - row.cogsTheoretical;
      return {
        ...row,
        grossProfit,
        grossMargin,
        netOperatingProfit: ebt,
        tax,
        reserve,
        netIncome,
        retainedProfit,
        costVariance,
      };
    });

  // 6) Tổng hợp toàn kỳ
  const totals = byDay.reduce((acc, r) => {
    acc.revenue += r.revenue;
    acc.cogsActual += r.cogsActual;
    acc.cogsTheoretical += r.cogsTheoretical;
    acc.opexVariable += r.opexVariable;
    acc.opexFixed += r.opexFixed;
    acc.depreciation += r.depreciation;
    acc.ownerDraw += r.ownerDraw;
    acc.bills += r.bills;
    return acc;
  }, emptyKpi());

  totals.grossProfit = totals.revenue - totals.cogsActual;
  totals.grossMargin = totals.revenue > 0 ? totals.grossProfit / totals.revenue : 0;
  totals.netOperatingProfit =
    totals.grossProfit - totals.opexVariable - totals.opexFixed - totals.depreciation;
  totals.tax = computeTax(totals.revenue, totals.netOperatingProfit, settings);
  totals.reserve = Math.max(0, totals.revenue) * reservePct;
  totals.netIncome = totals.netOperatingProfit - totals.tax - totals.reserve;
  totals.retainedProfit = totals.netIncome - totals.ownerDraw;
  totals.costVariance = totals.cogsActual - totals.cogsTheoretical;

  // 7) Breakdown category (sort theo amount giảm dần)
  const byCategory = Array.from(categoryMap.values())
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return {
    from,
    to,
    daysCount,
    totals,
    byDay,
    byCategory,
  };
};

/**
 * Helper format VND.
 */
export const formatVND = (n) =>
  new Intl.NumberFormat('vi-VN').format(Math.round(toNumber(n))) + ' ₫';

/**
 * Helper format phần trăm (input là decimal: 0.25 → "25,0%").
 */
export const formatPercent = (n, digits = 1) => {
  const num = toNumber(n) * 100;
  return `${num.toFixed(digits).replace('.', ',')}%`;
};

/**
 * Default settings để fallback khi chưa có doc trong Firestore.
 */
export const DEFAULT_PNL_SETTINGS = {
  taxRate: 0,
  taxMode: 'on_profit_before_tax',
  depreciationMonthly: 0,
  otherReservePercent: 0,
  useTheoreticalCost: true,
};
