#!/usr/bin/env node

/**
 * Script để setup deployment lên Vercel
 * Chạy: npm run deploy:setup
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🚀 Setup Deployment cho Vercel\n');

// Kiểm tra các file cần thiết
function checkRequiredFiles() {
  const requiredFiles = [
    'package.json',
    'vite.config.js',
    'vercel.json',
    'src/config/firebase.example.js'
  ];

  console.log('📋 Kiểm tra các file cần thiết...');
  const missingFiles = requiredFiles.filter(file => {
    const exists = fs.existsSync(path.join(rootDir, file));
    console.log(`  ${exists ? '✅' : '❌'} ${file}`);
    return !exists;
  });

  if (missingFiles.length > 0) {
    console.error(`\n❌ Thiếu các file: ${missingFiles.join(', ')}`);
    process.exit(1);
  }
  console.log('✅ Tất cả file cần thiết đã có\n');
}

// Kiểm tra environment variables template
function checkEnvTemplate() {
  console.log('🔧 Kiểm tra template environment variables...');
  
  const envTemplate = `# Environment Variables cho Vercel Deployment
# Copy các giá trị này vào Vercel Dashboard > Project Settings > Environment Variables

VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# Lưu ý: Thay thế "your-*" bằng giá trị thực từ Firebase Console`;

  const envPath = path.join(rootDir, '.env.vercel.example');
  
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, envTemplate);
    console.log('✅ Đã tạo .env.vercel.example');
  } else {
    console.log('✅ .env.vercel.example đã tồn tại');
  }
  console.log('');
}

// Kiểm tra Git status
function checkGitStatus() {
  console.log('📂 Hướng dẫn Git và GitHub...');
  console.log('  1. Đảm bảo code đã được commit:');
  console.log('     git add .');
  console.log('     git commit -m "Ready for deployment"');
  console.log('');
  console.log('  2. Push lên GitHub repository:');
  console.log('     git remote add origin https://github.com/your-username/manage-bill.git');
  console.log('     git branch -M main');
  console.log('     git push -u origin main');
  console.log('');
}

// Hiển thị hướng dẫn Vercel
function showVercelInstructions() {
  console.log('🌐 Hướng dẫn deploy lên Vercel:');
  console.log('');
  console.log('  1. Truy cập https://vercel.com và đăng nhập bằng GitHub');
  console.log('  2. Click "New Project"');
  console.log('  3. Import repository từ GitHub');
  console.log('  4. Vercel sẽ tự động detect framework: Vite');
  console.log('  5. Cấu hình Environment Variables:');
  console.log('     - Vào Project Settings > Environment Variables');
  console.log('     - Thêm các biến từ file .env.vercel.example');
  console.log('     - Lấy giá trị từ Firebase Console');
  console.log('  6. Deploy!');
  console.log('');
}

// Hiển thị checklist cuối
function showFinalChecklist() {
  console.log('✅ Checklist trước khi deploy:');
  console.log('  □ Code đã được test local');
  console.log('  □ Firebase project đã setup');
  console.log('  □ Code đã push lên GitHub');
  console.log('  □ Environment variables đã chuẩn bị');
  console.log('  □ Vercel project đã tạo và configure');
  console.log('');
  console.log('🎉 Sau khi deploy thành công:');
  console.log('  - Vercel sẽ cung cấp URL production');
  console.log('  - Mỗi commit mới sẽ auto-deploy');
  console.log('  - Preview deployments cho pull requests');
  console.log('');
}

// Main function
function main() {
  try {
    checkRequiredFiles();
    checkEnvTemplate();
    checkGitStatus();
    showVercelInstructions();
    showFinalChecklist();
    
    console.log('🚀 Hoàn tất setup! Bạn đã sẵn sàng deploy lên Vercel.');
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  }
}

main(); 