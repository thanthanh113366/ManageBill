# 🔧 Hướng Dẫn Setup Backend API Integration

## ✅ Đã Hoàn Thành

1. ✅ Tạo hook `useBackendWhisperRecognition.js` - Record audio và gọi backend API
2. ✅ Cập nhật `VoiceOrderButton.jsx` - Chỉ dùng backend API, loại bỏ Web Speech và Whisper Cloud
3. ✅ Logic parse và match đã sẵn sàng (dùng `parseVoiceOrder()` và `menuMatcher()`)

---

## 📝 Cấu Hình Environment Variable

### **Tạo file `.env` trong root directory:**

```env
VITE_BACKEND_API_URL=https://therapist-squad-requiring-steady.trycloudflare.com
```

**Lưu ý:**
- Nếu không có `.env`, hệ thống sẽ dùng URL mặc định từ `API_DOCUMENTATION.md`
- Restart dev server sau khi thêm `.env`: `npm run dev`

---

## 🔄 Flow Hoạt Động

```
1. User Click "Nói đơn"
   ↓
2. Record Audio (MediaRecorder)
   ↓
3. User Click "Dừng"
   ↓
4. Send Audio → Backend API: POST /transcribe
   ↓
5. Backend: Whisper transcribe → { "text": "Ốc hương 1 phần, ốc len 1 phần" }
   ↓
6. Frontend: parseVoiceOrder(transcript) → [{quantity: 1, dishName: "ốc hương"}, ...]
   ↓
7. Frontend: menuMatcher() → Match với menuItems từ Firebase
   ↓
8. Preview Modal → User Xác Nhận
   ↓
9. Add vào Bill
```

---

## 🧪 Testing

### **1. Kiểm tra Backend API:**
```bash
# Test với cURL
curl -X POST https://therapist-squad-requiring-steady.trycloudflare.com/transcribe \
  -F "file=@test_audio.webm"
```

### **2. Test Frontend:**
1. Chạy dev server: `npm run dev`
2. Vào trang Create Bill
3. Click "Nói đơn"
4. Nói: "Ốc hương 1 phần, ốc len 1 phần"
5. Click "Dừng"
6. Chờ backend transcribe (2-5 giây)
7. Xem Preview Modal với matched items

---

## 🐛 Troubleshooting

### **Lỗi: "Không thể kết nối đến backend"**
- Kiểm tra `VITE_BACKEND_API_URL` trong `.env`
- Kiểm tra backend có đang chạy không
- Kiểm tra CORS settings trên backend

### **Lỗi: "503 Service Unavailable"**
- Backend Whisper service đang tắt
- Thử lại sau vài phút

### **Lỗi: "Empty transcript received"**
- Audio quá ngắn hoặc không có giọng nói
- Thử nói lại rõ ràng hơn

### **Parse không đúng:**
- Kiểm tra format: "Tên món số phần"
- Xem console log để debug

---

## 📋 Checklist

- [ ] Đã thêm `VITE_BACKEND_API_URL` vào `.env`
- [ ] Đã restart dev server
- [ ] Đã test record audio
- [ ] Đã test gọi backend API
- [ ] Đã test parse transcript
- [ ] Đã test match với menu items
- [ ] Đã test preview modal
- [ ] Đã test add vào bill

---

## ✅ Status

**Ready to use!** Tất cả code đã được tích hợp. Chỉ cần:
1. Thêm `.env` với `VITE_BACKEND_API_URL`
2. Restart server
3. Test!

