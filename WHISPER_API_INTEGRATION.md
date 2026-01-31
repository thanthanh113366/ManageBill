# 🎤 Hướng Dẫn Tích Hợp Whisper API cho Speech-to-Text

## 📋 Tổng Quan

Whisper API của OpenAI cung cấp độ chính xác cao hơn Web Speech API, đặc biệt với tiếng Việt. Có 2 cách tích hợp:

1. **Whisper API (Cloud)** - Dễ setup, cần API key, có phí
2. **Whisper Local** - Miễn phí, cần backend server

---

## 🎯 Option 1: Whisper API (OpenAI Cloud) - Khuyến Nghị

### **Ưu Điểm:**
- ✅ Dễ tích hợp (chỉ cần API key)
- ✅ Không cần backend server
- ✅ Độ chính xác cao
- ✅ Hỗ trợ nhiều định dạng audio

### **Nhược Điểm:**
- ⚠️ Cần internet
- ⚠️ Có phí: $0.006/phút (~$0.36/giờ)
- ⚠️ Data gửi lên OpenAI server

### **Setup Steps:**

#### **1. Cài Đặt Dependencies:**
```bash
npm install openai
```

#### **2. Tạo API Key:**
- Đăng ký tại: https://platform.openai.com/
- Tạo API key tại: https://platform.openai.com/api-keys
- Thêm vào `.env`:
```env
VITE_OPENAI_API_KEY=sk-...
```

#### **3. Tạo Hook mới: `useWhisperRecognition.js`**

File này sẽ thay thế `useSpeechRecognition.js` hoặc dùng song song.

---

## 🎯 Option 2: Whisper Local (Backend Server)

### **Ưu Điểm:**
- ✅ Miễn phí (không có phí API)
- ✅ Privacy (data không gửi lên cloud)
- ✅ Không cần internet (sau khi setup)

### **Nhược Điểm:**
- ⚠️ Cần backend server (Python + Whisper model)
- ⚠️ Setup phức tạp hơn
- ⚠️ Cần GPU để chạy nhanh (CPU cũng được nhưng chậm)

### **Setup Steps:**

#### **1. Tạo Backend Server (Python):**
```bash
mkdir whisper-backend
cd whisper-backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install fastapi uvicorn openai-whisper python-multipart
```

#### **2. Tạo API Endpoint:**
File `app.py`:
```python
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import whisper
import io
import tempfile
import os

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Hoặc chỉ frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Whisper model (chỉ load 1 lần khi start server)
model = whisper.load_model("base")  # base, small, medium, large

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    # Save audio to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        # Transcribe
        result = model.transcribe(tmp_path, language="vi")
        return {"text": result["text"]}
    finally:
        # Cleanup
        os.unlink(tmp_path)
```

#### **3. Chạy Server:**
```bash
uvicorn app:app --host 0.0.0.0 --port 8000
```

#### **4. Expose qua Cloudflare Tunnel (nếu cần):**
```bash
cloudflared tunnel --url http://localhost:8000
```

---

## 💻 Implementation Code

Xem các file sau:
- `src/hooks/useWhisperRecognition.js` - Hook cho Whisper API (Cloud)
- `src/hooks/useWhisperLocal.js` - Hook cho Whisper Local (Backend)
- `src/components/VoiceOrderButton.jsx` - Updated để hỗ trợ cả 2 options

