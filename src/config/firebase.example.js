import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration
// Sao chép từ Firebase Console > Project Settings > General > Your apps
// Thay thế các giá trị "your-*" bằng thông tin thực tế từ Firebase project
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project-id.firebaseapp.com", 
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};

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