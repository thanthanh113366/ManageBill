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

async function exportMenuNames() {
  console.log('🚀 Bắt đầu lấy tên món ăn...');

  // 1. Load menuItems
  console.log('📦 Đang load menuItems...');
  const menuItemsSnap = await getDocs(collection(db, 'menuItems'));
  const menuItems = [];
  menuItemsSnap.docs.forEach(doc => {
    const data = doc.data();
    if (data.name) {
      menuItems.push({
        id: doc.id,
        name: data.name,
        source: 'menuItems',
      });
    }
  });
  console.log(`   ✅ ${menuItems.length} menuItems có tên`);

  // 2. Load orderItems
  console.log('📦 Đang load orderItems...');
  const orderItemsSnap = await getDocs(collection(db, 'orderItems'));
  const orderItems = [];
  orderItemsSnap.docs.forEach(doc => {
    const data = doc.data();
    if (data.name) {
      orderItems.push({
        id: doc.id,
        name: data.name,
        source: 'orderItems',
      });
    }
  });
  console.log(`   ✅ ${orderItems.length} orderItems có tên`);

  // 3. Gộp và lọc trùng theo tên (case-insensitive)
  const allItems = [...menuItems, ...orderItems];
  const seenNames = new Set();
  const uniqueNames = [];

  for (const item of allItems) {
    const normalized = item.name.trim().toLowerCase();
    if (!seenNames.has(normalized)) {
      seenNames.add(normalized);
      uniqueNames.push(item.name.trim());
    }
  }

  uniqueNames.sort((a, b) => a.localeCompare(b, 'vi'));

  // 4. Chuẩn bị output
  const output = {
    exportedAt: new Date().toISOString(),
    totalMenuItems: menuItems.length,
    totalOrderItems: orderItems.length,
    totalUnique: uniqueNames.length,
    names: uniqueNames,
    details: allItems,
  };

  // 5. Ghi file
  const outputPath = 'menu-names.json';
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');

  console.log('\n🎉 HOÀN THÀNH!');
  console.log(`📦 menuItems: ${menuItems.length}`);
  console.log(`📦 orderItems: ${orderItems.length}`);
  console.log(`✨ Tổng tên duy nhất: ${uniqueNames.length}`);
  console.log(`📄 File đã lưu: ${outputPath}`);
}

exportMenuNames()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 Lỗi:', err);
    process.exit(1);
  });
