import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Kiểm tra môi trường và sử dụng config phù hợp
const isProduction = import.meta.env.PROD;
const hasEnvVars = import.meta.env.VITE_FIREBASE_API_KEY;

let firebaseConfig;

if (isProduction || hasEnvVars) {
  // Production: sử dụng environment variables
  firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  };
  
  // Kiểm tra tính đầy đủ của env vars
  const requiredEnvVars = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID'];
  const missingVars = requiredEnvVars.filter(envVar => !import.meta.env[envVar]);
  
  if (missingVars.length > 0) {
    console.error('Missing Firebase environment variables:', missingVars);
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
} else {
  // Development: sử dụng config cục bộ
  // Sao chép từ Firebase Console > Project Settings > General > Your apps
  // Thay thế các giá trị "your-*" bằng thông tin thực tế từ Firebase project
  firebaseConfig = {
    apiKey: "your-api-key",
    authDomain: "your-project-id.firebaseapp.com", 
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
  };
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

export default app;

/*
HƯỚNG DẪN SETUP:
1. Sao chép file này thành "firebase.js" (xóa .example)
2. Vào Firebase Console: https://console.firebase.google.com/
3. Chọn project của bạn > Project Settings > General
4. Scroll xuống "Your apps" > chọn web app
5. Copy Firebase config object
6. Thay thế toàn bộ firebaseConfig ở trên
7. Lưu file

LƯU Ý BẢO MẬT:
- File firebase.js sẽ không được commit lên Git (đã thêm vào .gitignore)
- Không chia sẻ API keys công khai
- Trong production, nên sử dụng environment variables
*/ 