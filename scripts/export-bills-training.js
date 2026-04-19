import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function exportBillsForTraining() {
  console.log('🚀 Bắt đầu export bills...');

  // 1. Load toàn bộ orderItems & menuItems vào Map để tra nhanh
  console.log('📦 Đang load orderItems...');
  const orderItemsSnap = await getDocs(collection(db, 'orderItems'));
  const orderItemMap = new Map();
  orderItemsSnap.docs.forEach(doc => {
    orderItemMap.set(doc.id, doc.data().name ?? null);
  });
  console.log(`   ✅ ${orderItemMap.size} orderItems`);

  console.log('📦 Đang load menuItems...');
  const menuItemsSnap = await getDocs(collection(db, 'menuItems'));
  const menuItemMap = new Map();
  menuItemsSnap.docs.forEach(doc => {
    menuItemMap.set(doc.id, doc.data().name ?? null);
  });
  console.log(`   ✅ ${menuItemMap.size} menuItems`);

  // 2. Load toàn bộ bills
  console.log('📦 Đang load bills...');
  const billsSnap = await getDocs(collection(db, 'bills'));
  console.log(`   ✅ ${billsSnap.docs.length} bills`);

  // 3. Xử lý từng bill
  const results = [];
  let skippedItems = 0;

  for (const billDoc of billsSnap.docs) {
    const bill = billDoc.data();

    // Resolve createdAt thành ISO string
    let createdAt = null;
    if (bill.createdAt) {
      const ts = bill.createdAt.toDate ? bill.createdAt.toDate() : new Date(bill.createdAt);
      createdAt = ts.toISOString();
    }

    const resolvedItems = [];

    for (const item of bill.items ?? []) {
      // Bỏ qua món tùy chỉnh (không có id tham chiếu)
      if (!item.orderItemId && !item.menuItemId) {
        skippedItems++;
        continue;
      }

      let itemId = null;
      let itemType = null;
      let itemName = null;

      if (item.orderItemId) {
        const name = orderItemMap.get(item.orderItemId);
        if (name != null) {
          itemId = item.orderItemId;
          itemType = 'orderItem';
          itemName = name;
        } else {
          // orderItemId không tìm thấy, thử fallback menuItemId
          if (item.menuItemId) {
            const mName = menuItemMap.get(item.menuItemId);
            if (mName != null) {
              itemId = item.menuItemId;
              itemType = 'menuItem';
              itemName = mName;
            }
          }
        }
      } else if (item.menuItemId) {
        const name = menuItemMap.get(item.menuItemId);
        if (name != null) {
          itemId = item.menuItemId;
          itemType = 'menuItem';
          itemName = name;
        }
      }

      if (!itemName) {
        skippedItems++;
        continue;
      }

      resolvedItems.push({
        [itemType === 'orderItem' ? 'orderItemId' : 'menuItemId']: itemId,
        name: itemName,
        quantity: item.quantity ?? 1,
      });
    }

    // Bỏ bill không có item hợp lệ nào
    if (resolvedItems.length === 0) continue;

    results.push({
      billId: billDoc.id,
      createdAt,
      tableNumber: bill.tableNumber ?? null,
      items: resolvedItems,
    });
  }

  // 4. Sort giảm dần theo createdAt
  results.sort((a, b) => {
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return b.createdAt.localeCompare(a.createdAt);
  });

  // 5. Ghi file
  const outputPath = 'bills-training.json';
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');

  console.log('\n🎉 HOÀN THÀNH!');
  console.log(`✅ Tổng bills xuất: ${results.length}`);
  console.log(`⏭️  Items bỏ qua (không tìm thấy tên / là món tùy chỉnh): ${skippedItems}`);
  console.log(`📄 File đã lưu: ${outputPath}`);
}

exportBillsForTraining()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 Lỗi:', err);
    process.exit(1);
  });
