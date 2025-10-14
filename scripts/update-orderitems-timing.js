import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';
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

async function updateOrderItemsWithTiming() {
  try {
    console.log('🚀 Bắt đầu cập nhật OrderItems với thông tin timing...');
    
    // Get all orderItems
    const orderItemsSnapshot = await getDocs(collection(db, 'orderItems'));
    console.log(`📋 Tìm thấy ${orderItemsSnapshot.size} orderItems`);
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (const docSnapshot of orderItemsSnapshot.docs) {
      try {
        const orderItem = docSnapshot.data();
        const itemName = orderItem.name || '';
        
        // Skip if already has timing fields
        if (orderItem.speed && orderItem.kitchenType && orderItem.estimatedTime && orderItem.priority) {
          console.log(`⏭️ Bỏ qua ${itemName} - đã có timing fields`);
          skipCount++;
          continue;
        }
        
        // Determine kitchen timing based on item name and category
        let speed = 'medium';
        let priority = 1;
        let kitchenType = 'cook';
        let estimatedTime = 2;

        // Logic to set timing based on item characteristics
        if (itemName.toLowerCase().includes('nướng') || itemName.toLowerCase().includes('grill')) {
          kitchenType = 'grill';
          estimatedTime = 3; // Grill takes longer
        }
        
        if (itemName.toLowerCase().includes('nhanh') || itemName.toLowerCase().includes('fast')) {
          speed = 'fast';
          estimatedTime = 1;
        } else if (itemName.toLowerCase().includes('chậm') || itemName.toLowerCase().includes('slow')) {
          speed = 'slow';
          estimatedTime = 4;
        }

        // Set priority based on category
        if (orderItem.category === 'oc') {
          priority = 1; // Highest priority for ốc
        } else if (orderItem.category === 'an_no') {
          priority = 2;
        } else if (orderItem.category === 'an_choi') {
          priority = 3;
        } else if (orderItem.category === 'giai_khat') {
          priority = 4; // Lowest priority for drinks
        }

        // Update the document
        await updateDoc(doc(db, 'orderItems', docSnapshot.id), {
          speed: speed,
          priority: priority,
          kitchenType: kitchenType,
          estimatedTime: estimatedTime
        });
        
        successCount++;
        console.log(`✅ Đã cập nhật: ${itemName} (${speed}, ${kitchenType}, ${estimatedTime}p, priority: ${priority})`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Lỗi cập nhật ${docSnapshot.id}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Cập nhật hoàn thành!`);
    console.log(`✅ Thành công: ${successCount}`);
    console.log(`⏭️ Bỏ qua: ${skipCount}`);
    console.log(`❌ Lỗi: ${errorCount}`);
    
  } catch (error) {
    console.error('❌ Lỗi trong quá trình cập nhật:', error);
  }
}

// Run the update
updateOrderItemsWithTiming().then(() => {
  console.log('🏁 Hoàn thành!');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Lỗi:', error);
  process.exit(1);
});
