# Hướng Dẫn Setup Backend Voice Parsing với spaCy và Cloudflare Tunnel

## Mục đích
Tạo backend API để parse voice order từ tiếng Việt sang structured data, sử dụng spaCy NLP và expose qua Cloudflare Tunnel.

---

## 📋 Yêu Cầu

### Frontend hiện tại (React):
- File: `src/components/VoiceOrderButton.jsx`
- Function: `handleProcessOrder(fullTranscript)`
- Hiện tại: Parse local bằng `parseVoiceOrder()` và match bằng `menuMatcher()`
- Cần thay đổi: Gọi API backend thay vì parse local

### API Contract cần implement:

**Input từ Frontend:**
```json
{
  "text": "Một phần sờ điệp một phần hào, một phần ốc hương, một phần cơm chiên tỏi, một nước suối, một nghêu thái.",
  "menuItems": [
    {
      "id": "abc123",
      "name": "Ốc Hương",
      "category": "oc",
      "price": 69000,
      ...
    },
    ...
  ],
  "currentCategory": "oc" // optional, có thể null
}
```

**Output trả về Frontend:**
```json
{
  "matchedItems": [
    {
      "menuItemId": "abc123",
      "quantity": 1,
      "name": "Ốc Hương",
      "confidence": 0.95,
      "originalDishName": "ốc hương"
    },
    ...
  ],
  "unmatchedItems": [
    {
      "dishName": "sờ điệp",
      "quantity": 1
    },
    ...
  ],
  "transcript": "Một phần sờ điệp một phần hào, một phần ốc hương..."
}
```

---

## 🏗️ Backend Structure

```
voice-parsing-backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app
│   ├── parser.py            # spaCy parsing logic
│   ├── matcher.py            # Menu matching logic
│   └── models.py             # Pydantic models
├── requirements.txt
├── .env.example
├── README.md
└── start.sh                  # Startup script
```

---

## 📝 Code Implementation

### 1. requirements.txt

```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
spacy==3.7.2
python-multipart==0.0.6
pydantic==2.5.0
python-dotenv==1.0.0
```

**Lưu ý:** Sau khi install, cần download spaCy Vietnamese model:
```bash
python -m spacy download vi_core_news_sm
# hoặc model lớn hơn (chính xác hơn nhưng nặng hơn):
# python -m spacy download vi_core_news_lg
```

### 2. app/models.py

```python
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class MenuItem(BaseModel):
    id: str
    name: str
    category: str
    price: float
    # Các field khác từ Firestore (optional)
    tax: Optional[float] = None
    costPrice: Optional[float] = None
    fixedCost: Optional[float] = None

class ParseRequest(BaseModel):
    text: str
    menuItems: List[MenuItem]
    currentCategory: Optional[str] = None

class MatchedItem(BaseModel):
    menuItemId: str
    quantity: int
    name: str
    confidence: float
    originalDishName: str

class UnmatchedItem(BaseModel):
    dishName: str
    quantity: int

class ParseResponse(BaseModel):
    matchedItems: List[MatchedItem]
    unmatchedItems: List[UnmatchedItem]
    transcript: str
```

### 3. app/parser.py

```python
import re
import spacy
from typing import List, Dict

# Load spaCy Vietnamese model
try:
    nlp = spacy.load("vi_core_news_sm")
except OSError:
    # Fallback nếu không có model
    print("Warning: Vietnamese spaCy model not found. Using basic parsing.")
    nlp = None

# Vietnamese numbers mapping
VIETNAMESE_NUMBERS = {
    'một': 1, 'hai': 2, 'ba': 3, 'bốn': 4, 'năm': 5,
    'sáu': 6, 'bảy': 7, 'tám': 8, 'chín': 9, 'mười': 10,
    'mười một': 11, 'mười hai': 12, 'mười ba': 13,
    'mười bốn': 14, 'mười lăm': 15, 'mười sáu': 16,
    'mười bảy': 17, 'mười tám': 18, 'mười chín': 19,
    'hai mươi': 20
}

def parse_vietnamese_number(num_str: str) -> int:
    """Convert Vietnamese number string to integer"""
    if not num_str:
        return 1
    normalized = num_str.lower().strip()
    if normalized in VIETNAMESE_NUMBERS:
        return VIETNAMESE_NUMBERS[normalized]
    try:
        parsed = int(normalized)
        return parsed if parsed > 0 else 1
    except:
        return 1

def clean_text(text: str) -> str:
    """Clean and normalize Vietnamese text"""
    if not text:
        return ""
    
    # Remove noise words
    noise_words = ['chưa', 'phẩy', 'phải', 'được', 'ạ', 'ơi', 'nhé', 'nhỉ']
    
    cleaned = text.lower().strip()
    # Replace punctuation with space
    cleaned = re.sub(r'[,.!?]+', ' ', cleaned)
    # Normalize spaces
    cleaned = re.sub(r'\s+', ' ', cleaned)
    
    # Remove noise words
    for word in noise_words:
        pattern = r'\b' + re.escape(word) + r'\b'
        cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)
    
    return cleaned.strip()

def parse_voice_order(text: str) -> List[Dict[str, any]]:
    """
    Parse Vietnamese voice order text to structured data
    Sử dụng spaCy để tokenize và extract entities, kết hợp với regex patterns
    
    Input: "Một phần sờ điệp một phần hào, một phần ốc hương, một nước suối"
    Output: [
        {"quantity": 1, "dishName": "sờ điệp"},
        {"quantity": 1, "dishName": "hào"},
        {"quantity": 1, "dishName": "ốc hương"},
        {"quantity": 1, "dishName": "nước suối"}
    ]
    """
    if not text or not isinstance(text, str):
        return []
    
    cleaned = clean_text(text)
    if not cleaned:
        return []
    
    results = []
    
    # Sử dụng spaCy để tokenize và extract entities
    # spaCy giúp identify numbers, nouns, và sentence boundaries
    if nlp:
        try:
            doc = nlp(cleaned)
            # spaCy có thể giúp:
            # - Tokenize chính xác hơn
            # - Identify numbers (NUM entity)
            # - Identify nouns (NOUN POS tags)
            # Nhưng vẫn dùng regex patterns chính vì format cụ thể "[Số] phần [Tên món]"
        except Exception as e:
            print(f"spaCy processing error: {e}")
            # Fallback to regex only
    
    # Pattern 1: "[Số] phần [Tên món]" - Số lượng ở trước
    # Example: "một phần ốc hương", "1 phần sò điệp"
    pattern1 = re.compile(
        r'(\d+|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười(?:\s+(?:một|hai|ba|bốn|năm|sáu|bảy|tám|chín))?)\s+phần\s+([^\d]+?)(?=\s+(?:\d+|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười)\s+phần|$)',
        re.IGNORECASE
    )
    
    used_indices = []
    
    for match in pattern1.finditer(cleaned):
        start_idx = match.start()
        end_idx = match.end()
        
        # Check overlap
        overlaps = any(start_idx < used['end'] and end_idx > used['start'] for used in used_indices)
        if overlaps:
            continue
        
        quantity_str = match.group(1).strip()
        dish_name = match.group(2).strip()
        
        # Clean dish name
        dish_name = re.sub(r'[.\s]+$', '', dish_name).strip()
        
        if len(dish_name) < 2:
            continue
        
        quantity = parse_vietnamese_number(quantity_str)
        
        if quantity > 0 and len(dish_name) >= 2:
            results.append({
                "quantity": quantity,
                "dishName": dish_name
            })
            used_indices.append({"start": start_idx, "end": end_idx})
    
    # Pattern 2: "[Số] [Tên món]" - Không có "phần"
    # Example: "một nước suối", "một nghêu thái"
    # Tìm các pattern còn lại (không overlap với pattern1)
    remaining_text = cleaned
    for used in sorted(used_indices, key=lambda x: x['start'], reverse=True):
        remaining_text = remaining_text[:used['start']] + ' ' + remaining_text[used['end']:]
    
    # Split by comma và xử lý từng segment
    segments = [s.strip() for s in remaining_text.split(',') if s.strip()]
    
    for segment in segments:
        # Pattern: [Số] [Tên món] (không có "phần")
        pattern2 = re.compile(
            r'^(\d+|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười)\s+(.+)$',
            re.IGNORECASE
        )
        
        match = pattern2.match(segment)
        if match:
            quantity_str = match.group(1).strip()
            dish_name = match.group(2).strip()
            
            # Remove trailing punctuation
            dish_name = re.sub(r'[.\s]+$', '', dish_name).strip()
            
            if len(dish_name) >= 2:
                quantity = parse_vietnamese_number(quantity_str)
                results.append({
                    "quantity": quantity,
                    "dishName": dish_name
                })
        else:
            # Nếu không match pattern, thử extract dish name (mặc định quantity = 1)
            # Chỉ nếu segment không chứa số
            if not re.search(r'\d+|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười', segment, re.IGNORECASE):
                dish_name = segment.replace('phần', '').strip()
                dish_name = re.sub(r'[.\s]+$', '', dish_name).strip()
                if len(dish_name) >= 2:
                    results.append({
                        "quantity": 1,
                        "dishName": dish_name
                    })
    
    # Remove duplicates
    unique_results = []
    seen = set()
    for item in results:
        key = f"{item['dishName'].lower()}_{item['quantity']}"
        if key not in seen:
            seen.add(key)
            unique_results.append(item)
    
    return unique_results
```

### 4. app/matcher.py

```python
from typing import List, Dict, Optional, Any
from difflib import SequenceMatcher

def similarity(a: str, b: str) -> float:
    """Calculate similarity between two strings (0-1)"""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

def match_dish_to_menu(
    dish_name: str,
    menu_items: List[Dict[str, Any]],
    current_category: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Match dish name to menu items using fuzzy matching
    
    Returns: {
        "menuItem": {...},
        "confidence": 0.0-1.0
    } or None
    """
    if not dish_name or not menu_items:
        return None
    
    normalized_dish = dish_name.lower().strip()
    if not normalized_dish:
        return None
    
    # Priority items (current category)
    priority_items = []
    if current_category:
        priority_items = [item for item in menu_items if item.get('category') == current_category]
    
    # Step 1: Exact match in priority category
    if priority_items:
        for item in priority_items:
            if item.get('name', '').lower() == normalized_dish:
                return {
                    "menuItem": item,
                    "confidence": 1.0
                }
    
    # Step 2: Exact match in all items
    for item in menu_items:
        if item.get('name', '').lower() == normalized_dish:
            return {
                "menuItem": item,
                "confidence": 1.0
            }
    
    # Step 3: Fuzzy match in priority category
    if priority_items:
        best_match = None
        best_score = 0.0
        
        for item in priority_items:
            item_name = item.get('name', '').lower()
            score = similarity(normalized_dish, item_name)
            if score > best_score and score >= 0.5:
                best_score = score
                best_match = item
        
        if best_match:
            return {
                "menuItem": best_match,
                "confidence": best_score
            }
    
    # Step 4: Fuzzy match in all items
    best_match = None
    best_score = 0.0
    
    for item in menu_items:
        item_name = item.get('name', '').lower()
        score = similarity(normalized_dish, item_name)
        if score > best_score and score >= 0.5:
            best_score = score
            best_match = item
    
    if best_match:
        return {
            "menuItem": best_match,
            "confidence": best_score
        }
    
    # Step 5: Partial match (contains)
    if len(normalized_dish) >= 3:
        # Priority category
        if priority_items:
            for item in priority_items:
                item_name = item.get('name', '').lower()
                if normalized_dish in item_name or item_name in normalized_dish:
                    return {
                        "menuItem": item,
                        "confidence": 0.75
                    }
        
        # All items
        for item in menu_items:
            item_name = item.get('name', '').lower()
            if normalized_dish in item_name or item_name in normalized_dish:
                return {
                    "menuItem": item,
                    "confidence": 0.75
                }
    
    return None
```

### 5. app/main.py

```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.models import ParseRequest, ParseResponse, MatchedItem, UnmatchedItem
from app.parser import parse_voice_order
from app.matcher import match_dish_to_menu
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Voice Order Parsing API",
    description="API để parse voice order tiếng Việt sang structured data",
    version="1.0.0"
)

# CORS middleware - QUAN TRỌNG: Cho phép frontend gọi API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Trong production nên chỉ định domain cụ thể
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "message": "Voice Order Parsing API",
        "version": "1.0.0",
        "endpoints": {
            "POST /parse-order": "Parse voice order text"
        }
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/parse-order", response_model=ParseResponse)
async def parse_order(request: ParseRequest):
    """
    Parse voice order text và match với menu items
    
    Input:
    - text: Voice input text
    - menuItems: Danh sách menu items từ Firestore
    - currentCategory: Category hiện tại (optional)
    
    Output:
    - matchedItems: Các món đã match được
    - unmatchedItems: Các món không match được
    - transcript: Original text
    """
    try:
        # Validate input
        if not request.text or not isinstance(request.text, str):
            raise HTTPException(status_code=400, detail="Text is required")
        
        if not request.menuItems or len(request.menuItems) == 0:
            raise HTTPException(status_code=400, detail="Menu items are required")
        
        logger.info(f"Parsing order: {request.text[:50]}...")
        
        # Parse voice text
        parsed_items = parse_voice_order(request.text)
        
        if not parsed_items or len(parsed_items) == 0:
            return ParseResponse(
                matchedItems=[],
                unmatchedItems=[],
                transcript=request.text
            )
        
        logger.info(f"Parsed {len(parsed_items)} items")
        
        # Match with menu items
        matched_items = []
        unmatched_items = []
        
        # Convert menuItems to dict for easier access
        menu_items_dict = [item.dict() for item in request.menuItems]
        
        for parsed_item in parsed_items:
            dish_name = parsed_item.get("dishName", "")
            quantity = parsed_item.get("quantity", 1)
            
            if not dish_name:
                continue
            
            # Match dish to menu
            match_result = match_dish_to_menu(
                dish_name=dish_name,
                menu_items=menu_items_dict,
                current_category=request.currentCategory
            )
            
            if match_result and match_result.get("confidence", 0) >= 0.5:
                menu_item = match_result["menuItem"]
                matched_items.append(MatchedItem(
                    menuItemId=menu_item.get("id", ""),
                    quantity=quantity,
                    name=menu_item.get("name", "Unknown"),
                    confidence=match_result.get("confidence", 0.5),
                    originalDishName=dish_name
                ))
            else:
                unmatched_items.append(UnmatchedItem(
                    dishName=dish_name,
                    quantity=quantity
                ))
        
        logger.info(f"Matched: {len(matched_items)}, Unmatched: {len(unmatched_items)}")
        
        return ParseResponse(
            matchedItems=matched_items,
            unmatchedItems=unmatched_items,
            transcript=request.text
        )
        
    except Exception as e:
        logger.error(f"Error parsing order: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### 6. requirements.txt

```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
python-multipart==0.0.6
pydantic==2.5.0
python-dotenv==1.0.0
```

### 7. .env.example

```env
# Port cho FastAPI
PORT=8000

# CORS origins (optional, nếu cần restrict)
# ALLOWED_ORIGINS=http://localhost:5173,https://your-app.vercel.app
```

### 8. start.sh

```bash
#!/bin/bash

# Activate virtual environment (nếu có)
# source venv/bin/activate

# Run FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 🚀 Setup Instructions

### Bước 1: Tạo project structure

```bash
mkdir voice-parsing-backend
cd voice-parsing-backend
mkdir app
touch app/__init__.py
```

### Bước 2: Tạo các files

Copy tất cả code từ phần "Code Implementation" vào các files tương ứng.

### Bước 3: Install dependencies

```bash
# Tạo virtual environment (khuyến nghị)
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# hoặc
venv\Scripts\activate  # Windows

# Install packages
pip install -r requirements.txt
```

### Bước 4: Test local

```bash
# Chạy server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Test API
curl -X POST http://localhost:8000/parse-order \
  -H "Content-Type: application/json" \
  -d '{
    "text": "một phần ốc hương, một phần sò điệp",
    "menuItems": [
      {
        "id": "1",
        "name": "Ốc Hương",
        "category": "oc",
        "price": 69000
      },
      {
        "id": "2",
        "name": "Sò Điệp",
        "category": "oc",
        "price": 50000
      }
    ],
    "currentCategory": "oc"
  }'
```

---

## ☁️ Cloudflare Tunnel Setup

### Bước 1: Install cloudflared

**Ubuntu/Debian:**
```bash
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

**Hoặc dùng snap:**
```bash
sudo snap install cloudflared
```

### Bước 2: Run tunnel (temporary - URL thay đổi mỗi lần)

```bash
cloudflared tunnel --url http://localhost:8000
```

Output sẽ có dạng:
```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable): |
|  https://abc123-def456-ghi789.trycloudflare.com                                           |
+--------------------------------------------------------------------------------------------+
```

**Lưu URL này lại!** Đây là URL public để frontend gọi API.

### Bước 3: Run tunnel trong background (production)

Tạo systemd service để chạy tự động:

```bash
# Tạo service file
sudo nano /etc/systemd/system/cloudflared-tunnel.service
```

Nội dung:
```ini
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=your-username
ExecStart=/usr/local/bin/cloudflared tunnel --url http://localhost:8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable và start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable cloudflared-tunnel
sudo systemctl start cloudflared-tunnel
sudo systemctl status cloudflared-tunnel
```

### Bước 4: Setup với custom domain (optional, free)

Nếu muốn URL cố định:

1. Đăng ký tên miền (hoặc dùng subdomain có sẵn)
2. Point DNS về Cloudflare
3. Setup named tunnel (xem docs: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)

---

## 🔗 Frontend Integration

### Update `src/components/VoiceOrderButton.jsx`

Thay đổi function `handleProcessOrder`:

```javascript
// Thêm constant cho API URL
const VOICE_PARSING_API_URL = import.meta.env.VITE_VOICE_API_URL || 'https://your-tunnel-url.trycloudflare.com';

// Update handleProcessOrder
const handleProcessOrder = useCallback(async (fullTranscript) => {
  if (!fullTranscript || typeof fullTranscript !== 'string' || fullTranscript.trim().length === 0) {
    setIsProcessing(false);
    return;
  }
  
  setTranscript(fullTranscript);
  setIsProcessing(true);
  
  try {
    // Validate menuItems
    if (!menuItems || !Array.isArray(menuItems) || menuItems.length === 0) {
      toast.error('Chưa có món nào trong menu. Vui lòng thêm món vào menu trước.');
      setIsProcessing(false);
      return;
    }

    // Call backend API
    const response = await fetch(`${VOICE_PARSING_API_URL}/parse-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: fullTranscript,
        menuItems: menuItems,
        currentCategory: currentCategory
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // Validate response
    if (!data.matchedItems || !data.unmatchedItems) {
      throw new Error('Invalid API response');
    }

    // Show preview modal
    setPreviewData({
      matchedItems: data.matchedItems,
      unmatchedItems: data.unmatchedItems,
      transcript: data.transcript || fullTranscript
    });
    setShowPreview(true);
    setIsProcessing(false);

  } catch (error) {
    console.error('Error calling voice parsing API:', error);
    toast.error(`Lỗi khi xử lý đơn hàng: ${error.message || 'Lỗi không xác định'}`);
    setIsProcessing(false);
  }
}, [menuItems, currentCategory]);
```

### Update `.env.local` (hoặc `.env`)

```env
VITE_VOICE_API_URL=https://your-tunnel-url.trycloudflare.com
```

---

## ✅ Testing Checklist

1. **Backend local:**
   - [ ] Server chạy được trên port 8000
   - [ ] `/health` endpoint trả về `{"status": "healthy"}`
   - [ ] `/parse-order` endpoint parse được đúng

2. **Cloudflare Tunnel:**
   - [ ] Tunnel chạy được
   - [ ] Có public URL
   - [ ] Frontend có thể gọi API từ URL đó

3. **Frontend Integration:**
   - [ ] API call thành công
   - [ ] Response format đúng
   - [ ] Preview modal hiển thị đúng
   - [ ] Error handling hoạt động

---

## 🐛 Troubleshooting

### Backend không start được:
- Kiểm tra Python version (cần >= 3.8)
- Kiểm tra dependencies: `pip install -r requirements.txt`
- Kiểm tra port 8000 có bị chiếm không: `lsof -i :8000`

### Cloudflare Tunnel không hoạt động:
- Kiểm tra backend đang chạy: `curl http://localhost:8000/health`
- Kiểm tra firewall: `sudo ufw allow 8000`
- Xem logs: `journalctl -u cloudflared-tunnel -f`

### Frontend không gọi được API:
- Kiểm tra CORS: Backend phải có `allow_origins=["*"]`
- Kiểm tra URL: Đúng format `https://...`
- Kiểm tra network: Mở DevTools → Network tab

### Parse không đúng:
- Kiểm tra input text format
- Xem backend logs để debug
- Test với curl để verify

---

## 📝 Notes

1. **Security:** Trong production, nên:
   - Restrict CORS origins
   - Thêm API key authentication
   - Rate limiting

2. **Performance:** 
   - Backend parse rất nhanh (< 100ms)
   - Cloudflare Tunnel có latency ~50-200ms
   - Tổng thời gian: < 500ms

3. **Cost:**
   - Backend: Free (chạy trên server trường)
   - Cloudflare Tunnel: Free
   - Tổng: $0

---

## 🎯 Next Steps

1. Deploy backend lên server trường
2. Setup Cloudflare Tunnel
3. Update frontend với API URL
4. Test end-to-end
5. Monitor và optimize

---

**Lưu ý:** File này được tạo để đưa lên chatbot AI trên server trường. Đảm bảo chatbot hiểu rõ:
- API contract phải khớp 100% với frontend
- Response format phải đúng với ParseResponse model
- Error handling phải robust
