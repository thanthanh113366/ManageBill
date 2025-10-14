import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
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

// Placeholder image URLs for different categories
const PLACEHOLDER_IMAGES = {
  oc: 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=300&h=300&fit=crop',
  an_no: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=300&h=300&fit=crop',
  an_choi: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=300&h=300&fit=crop',
  giai_khat: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=300&h=300&fit=crop'
};

// Category mapping
const CATEGORY_MAPPING = {
  'Ốc': 'oc',
  'Ăn no': 'an_no', 
  'Ăn chơi': 'an_choi',
  'Giải khát': 'giai_khat'
};

async function migrateOrderItemsFromStruct() {
  try {
    console.log('🚀 Bắt đầu migration OrderItems từ struct.txt...');
    
    // Read struct.txt file
    const structPath = path.join(process.cwd(), 'struct.txt');
    const structContent = fs.readFileSync(structPath, 'utf8');
    
    // Get existing menu items to map parentMenuItemId
    const menuItemsSnapshot = await getDocs(collection(db, 'menuItems'));
    const menuItems = {};
    menuItemsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      // Trim whitespace to handle database entries with trailing spaces
      menuItems[data.name.trim()] = doc.id;
    });
    
    console.log(`📋 Tìm thấy ${Object.keys(menuItems).length} menu items`);
    
    // Parse struct.txt content
    const lines = structContent.split('\n');
    const orderItems = [];
    let currentCategory = '';
    let currentParent = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      // Check if it's a main category
      if (trimmedLine.startsWith('# CATEGORY:')) {
        const categoryName = trimmedLine.replace('# CATEGORY:', '').trim();
        currentCategory = CATEGORY_MAPPING[categoryName] || 'oc';
        console.log(`📂 Xử lý category: ${categoryName} -> ${currentCategory}`);
        continue;
      }
      
      // Check if it's a parent menu item
      if (trimmedLine.startsWith('## MENU_ITEM:')) {
        const parentName = trimmedLine.replace('## MENU_ITEM:', '').trim();
        currentParent = parentName;
        console.log(`  📁 Parent: ${parentName}`);
        continue;
      }
      
      // Check if it's an order item (starts with - and has price)
      if (trimmedLine.startsWith('- ') && trimmedLine.includes('k')) {
        const itemLine = trimmedLine.replace('- ', '').trim();
        const match = itemLine.match(/^(.+?):\s*(\d+)k$/);
        
        if (match && currentParent) {
          const itemName = match[1].trim();
          const price = parseInt(match[2]) * 1000; // Convert to VND
          
          // Special handling for "Lai rai" items - they are standalone menu items
          if (currentParent === 'Lai rai') {
            // For Lai rai items, create them as standalone order items without parent
            orderItems.push({
              name: itemName,
              category: 'an_choi', // Always "Ăn chơi" category
              parentMenuItemId: null, // No parent for Lai rai items
              imageUrl: PLACEHOLDER_IMAGES.an_choi,
              // Kitchen timing fields
              speed: 'medium', // fast, medium, slow
              priority: 1, // 1-4 (1 = highest priority)
              kitchenType: 'cook', // cook, grill
              estimatedTime: 2 // minutes
            });
            
            console.log(`    ✅ ${itemName} (${price}₫) -> Lai rai (standalone)`);
            continue;
          }
          
          // Check if parent menu item exists for other items
          if (!menuItems[currentParent]) {
            console.log(`    ❌ Parent menu item "${currentParent}" không tồn tại trong database`);
            console.log(`    📋 Available menu items: ${Object.keys(menuItems).join(', ')}`);
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
          if (currentCategory === 'oc') {
            priority = 1; // Highest priority for ốc
          } else if (currentCategory === 'an_no') {
            priority = 2;
          } else if (currentCategory === 'an_choi') {
            priority = 3;
          } else if (currentCategory === 'giai_khat') {
            priority = 4; // Lowest priority for drinks
          }

          orderItems.push({
            name: itemName,
            category: currentCategory,
            parentMenuItemId: menuItems[currentParent],
            imageUrl: PLACEHOLDER_IMAGES[currentCategory] || PLACEHOLDER_IMAGES.oc,
            // Kitchen timing fields
            speed: speed,
            priority: priority,
            kitchenType: kitchenType,
            estimatedTime: estimatedTime
          });
          
          console.log(`    ✅ ${itemName} (${price}₫) -> ${currentParent}`);
        } else if (match && currentParent) {
          console.log(`    ❌ Không tìm thấy parent menu item: ${currentParent}`);
        }
      }
    }
    
    console.log(`\n📊 Tổng cộng tìm thấy ${orderItems.length} order items`);
    
    if (orderItems.length === 0) {
      console.log('❌ Không tìm thấy order items nào để import');
      return;
    }
    
    // Check existing order items to avoid duplicates
    console.log('\n🔍 Kiểm tra order items đã tồn tại...');
    const existingOrderItems = await getDocs(collection(db, 'orderItems'));
    const existingNames = new Set();
    existingOrderItems.forEach(doc => {
      existingNames.add(doc.data().name);
    });
    
    console.log(`📋 Đã có ${existingNames.size} order items trong database`);
    
    // Filter out existing items
    const newOrderItems = orderItems.filter(item => !existingNames.has(item.name));
    const duplicateItems = orderItems.filter(item => existingNames.has(item.name));
    
    if (duplicateItems.length > 0) {
      console.log(`\n⏭️  Bỏ qua ${duplicateItems.length} order items đã tồn tại:`);
      duplicateItems.forEach(item => {
        console.log(`   - ${item.name}`);
      });
    }
    
    if (newOrderItems.length === 0) {
      console.log('\n✅ Tất cả order items đã tồn tại. Không cần thêm mới.');
      return;
    }
    
    // Add new order items to Firestore
    console.log(`\n🚀 Bắt đầu thêm ${newOrderItems.length} order items mới vào Firestore...`);
    let successCount = 0;
    let errorCount = 0;
    
    for (const orderItem of newOrderItems) {
      try {
        await addDoc(collection(db, 'orderItems'), orderItem);
        successCount++;
        console.log(`✅ Đã thêm: ${orderItem.name}`);
        
        // Add small delay to avoid overwhelming Firebase
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        errorCount++;
        console.error(`❌ Lỗi khi thêm ${orderItem.name}:`, error.message);
      }
    }
    
    console.log('\n🎉 HOÀN THÀNH MIGRATION!');
    console.log(`✅ Thành công: ${successCount} order items`);
    console.log(`❌ Lỗi: ${errorCount} order items`);
    console.log(`📊 Tổng cộng: ${orderItems.length} order items`);
    
  } catch (error) {
    console.error('❌ Lỗi trong quá trình migration:', error);
  }
}

// Chạy script
console.log('🔧 Script Migration - Import OrderItems từ struct.txt');
console.log('💡 Script này sẽ tạo orderItems dựa trên cấu trúc trong struct.txt');
console.log('');

migrateOrderItemsFromStruct()
  .then(() => {
    console.log('\n✨ Script hoàn thành!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script thất bại:', error);
    process.exit(1);
  });
