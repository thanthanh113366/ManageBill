import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Firebase configuration for Node.js environment
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "your-api-key-here",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "your-project-id.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "your-project-id",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "your-project-id.appspot.com",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "your-sender-id",
  appId: process.env.VITE_FIREBASE_APP_ID || "your-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateKitchenTimings() {
  try {
    console.log('🚀 Bắt đầu migration Kitchen Timings...');
    
    // Check if menuItemTimings already exists
    const existingTimings = await getDocs(collection(db, 'menuItemTimings'));
    if (!existingTimings.empty) {
      console.log(`⚠️  Collection menuItemTimings đã tồn tại (${existingTimings.size} records).`);
      console.log('🔄 Xóa dữ liệu cũ và tạo lại...');
      
      // Delete existing timings
      for (const docSnapshot of existingTimings.docs) {
        await deleteDoc(doc(db, 'menuItemTimings', docSnapshot.id));
      }
      console.log('✅ Đã xóa dữ liệu cũ');
    }
    
    // Get all orderItems (món thực sự khách đặt)
    const orderItemsSnapshot = await getDocs(collection(db, 'orderItems'));
    console.log(`📋 Tìm thấy ${orderItemsSnapshot.size} món order`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const doc of orderItemsSnapshot.docs) {
      try {
        const orderItem = doc.data();
        
        // Create menuItemTiming với giá trị mặc định
        await addDoc(collection(db, 'menuItemTimings'), {
          menuItemId: orderItem.parentMenuItemId || doc.id, // Link đến menuItem gốc
          orderItemId: doc.id,  // ID của orderItem
          speed: "medium",      // Mặc định vừa
          kitchenType: "cook",  // Tất cả món = nấu
          estimatedTime: 2,     // 2 phút
          priority: 1,          // Tất cả món = priority cao
          createdAt: new Date()
        });
        
        successCount++;
        console.log(`✅ Đã tạo timing cho: ${orderItem.name}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Lỗi tạo timing cho ${doc.id}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Migration hoàn thành!`);
    console.log(`✅ Thành công: ${successCount}`);
    console.log(`❌ Lỗi: ${errorCount}`);
    
  } catch (error) {
    console.error('💥 Lỗi migration:', error);
  }
}

// Run migration
migrateKitchenTimings()
  .then(() => {
    console.log('🏁 Migration script hoàn thành');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration thất bại:', error);
    process.exit(1);
  });
