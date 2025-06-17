import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';

// Firebase configuration - thay thế bằng config thực tế của bạn
const firebaseConfig = {
  // Sao chép config từ src/config/firebase.js
  apiKey: "your-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateCategoriesForMenuItems() {
  try {
    console.log('🚀 Bắt đầu migration thêm category cho menuItems...');
    
    // Lấy tất cả documents trong collection menuItems
    const menuItemsRef = collection(db, 'menuItems');
    const snapshot = await getDocs(menuItemsRef);
    
    console.log(`📋 Tìm thấy ${snapshot.size} món ăn cần cập nhật`);
    
    if (snapshot.empty) {
      console.log('❌ Không có món ăn nào trong collection menuItems');
      return;
    }
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    // Duyệt qua từng document
    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      const docId = docSnapshot.id;
      
      // Kiểm tra xem document đã có category chưa
      if (data.category) {
        console.log(`⏭️  Bỏ qua "${data.name}" - đã có category: ${data.category}`);
        skippedCount++;
        continue;
      }
      
      try {
        // Cập nhật document với category mặc định là "oc"
        await updateDoc(doc(db, 'menuItems', docId), {
          category: 'oc'
        });
        
        console.log(`✅ Đã cập nhật "${data.name}" với category: "oc"`);
        updatedCount++;
        
        // Thêm delay nhỏ để tránh quá tải Firebase
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Lỗi khi cập nhật "${data.name}":`, error);
      }
    }
    
    console.log('\n🎉 HOÀN THÀNH MIGRATION!');
    console.log(`✅ Đã cập nhật: ${updatedCount} món ăn`);
    console.log(`⏭️  Đã bỏ qua: ${skippedCount} món ăn (đã có category)`);
    console.log(`📊 Tổng cộng: ${snapshot.size} món ăn`);
    
  } catch (error) {
    console.error('❌ Lỗi trong quá trình migration:', error);
  }
}

// Chạy script
console.log('🔧 Script Migration - Thêm Category cho Menu Items');
console.log('⚠️  Đảm bảo bạn đã cập nhật Firebase config ở trên!');
console.log('');

migrateCategoriesForMenuItems()
  .then(() => {
    console.log('\n✨ Script hoàn thành! Bạn có thể xóa file này sau khi chạy.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script thất bại:', error);
    process.exit(1);
  }); 