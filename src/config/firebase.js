import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration sử dụng environment variables
// Tự động fallback về placeholder values nếu không có env vars
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "your-api-key-here",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "your-project-id.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "your-project-id",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "your-project-id.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "your-sender-id",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "your-app-id"
};

// Kiểm tra xem có environment variables hay không
const hasValidConfig = import.meta.env.VITE_FIREBASE_API_KEY && 
                      import.meta.env.VITE_FIREBASE_PROJECT_ID;

if (!hasValidConfig) {
  console.warn(`
🔥 Firebase Configuration Warning:
Environment variables not found. Please create .env.local file with your Firebase config.

Required variables:
- VITE_FIREBASE_API_KEY
- VITE_FIREBASE_AUTH_DOMAIN  
- VITE_FIREBASE_PROJECT_ID
- VITE_FIREBASE_STORAGE_BUCKET
- VITE_FIREBASE_MESSAGING_SENDER_ID
- VITE_FIREBASE_APP_ID

Copy env.example to .env.local and fill in your Firebase project details.
  `);
}

// Initialize Firebase
console.log('🔥 Initializing Firebase with config:', {
  ...firebaseConfig,
  apiKey: firebaseConfig.apiKey ? '***' + firebaseConfig.apiKey.slice(-4) : 'MISSING'
});

const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

console.log('✅ Firebase initialized successfully');
console.log('📊 Firestore instance:', db);
console.log('🏗️ App instance:', app);

export default app; 