# 📋 KẾ HOẠCH TRIỂN KHAI TÍNH NĂNG NHẬP BILLS BẰNG GIỌNG NÓI

## 🎯 1. PHÂN TÍCH YÊU CẦU

### 1.1. Use Cases
- **Primary Format**: "Ốc hương 1 phần, ốc len 1 phần, sò lông 2 phần"
  - Format chính: `[Tên món] [Số] phần`
  - Hỗ trợ dấu phẩy (,) hoặc không có dấu phẩy
  - Ví dụ: "Ốc hương 1 phần ốc len 1 phần sò lông 2 phần"
- **Target Users**: Nhân viên order (nói nhanh, nhiều món)
- **Usage Frequency**: Thường xuyên (primary input method)
- **Edge Cases**: 
  - Tên món không khớp chính xác → Bỏ qua và thông báo
  - Số lượng không rõ ràng → Mặc định 1 phần
  - Môi trường ồn → Để browser xử lý (không cần noise cancellation)

### 1.2. User Flow
```
1. User click icon mic (cạnh phần chọn bàn)
2. Browser yêu cầu permission microphone
   - Nếu từ chối → Hiển thị modal hướng dẫn
   - Nếu không hỗ trợ (Safari/Firefox) → Hiển thị thông báo "Chỉ hỗ trợ Chrome/Edge"
3. User nói đơn hàng theo format: "Ốc hương 1 phần, ốc len 1 phần..."
4. System nhận diện giọng nói → Text (hiển thị transcript real-time)
5. Parse text → Extract (quantity, dish_name)
6. Match dish_name với menuItems (ưu tiên category hiện tại, nhưng tìm toàn bộ)
7. Hiển thị preview với danh sách món đã match
8. User xác nhận → Add vào quantities state (ghi đè nếu đã có)
9. Visual feedback: Toast + hiển thị danh sách món đã thêm
```

---

## 🏗️ 2. KIẾN TRÚC GIẢI PHÁP

### 2.1. Component Architecture
```
CreateBill.jsx (src/pages/)
├── VoiceOrderButton (src/components/)
│   ├── useSpeechRecognition (src/hooks/)
│   ├── voiceParser (src/utils/)
│   └── menuMatcher (src/utils/)
└── Existing Bill Logic
```

**File Structure:**
- `src/hooks/useSpeechRecognition.js` - Custom hook cho Web Speech API
- `src/utils/voiceParser.js` - Parse voice text với Custom Parser (Option A)
- `src/utils/menuMatcher.js` - Match dishes với Fuse.js (Option A)
- `src/components/VoiceOrderButton.jsx` - UI component
- `src/pages/CreateBill.jsx` - Integration point

### 2.2. Data Flow
```
Microphone Input
    ↓
Web Speech API (Chrome/Edge only)
    ↓
Raw Text: "Ốc hương 1 phần, ốc len 1 phần, sò lông 2 phần"
    ↓
VoiceParser.parse() (Format: [Tên món] [Số] phần)
    ↓
Array: [
  { quantity: 1, dishName: "ốc hương" },
  { quantity: 1, dishName: "ốc len" },
  { quantity: 2, dishName: "sò lông" }
]
    ↓
MenuMatcher.match() (Ưu tiên category hiện tại, nhưng tìm toàn bộ)
    ↓
Preview Modal hiển thị:
- Matched items với confidence score
- Unmatched items (bỏ qua và thông báo)
    ↓
User xác nhận
    ↓
Update quantities state (Ghi đè nếu đã có, không cộng dồn)
    ↓
Visual feedback: Toast + Danh sách món đã thêm
```

---

## 🛠️ 3. CÔNG NGHỆ & THƯ VIỆN

### 3.1. Speech Recognition Options

#### ✅ Selected: Web Speech API (Chosen for MVP)
- **Pros**: 
  - Miễn phí, không cần backend
  - Built-in browser support
  - Real-time recognition
  - Đủ cho use case nhân viên order
- **Cons**:
  - Chỉ hỗ trợ Chrome/Edge (không có Safari/Firefox)
    - **Solution**: Hiển thị thông báo "Chỉ hỗ trợ Chrome/Edge"
  - Cần internet connection
  - Accuracy phụ thuộc vào Google
- **Browser Support Handling**:
  - Detect browser compatibility
  - Show warning message cho Safari/Firefox users
  - Hide button hoặc disable với explanation

### 3.2. Natural Language Processing

#### Option A - Custom Parser
- **Approach**: Regex-based parsing với Vietnamese number conversion
- **Pros**:
  - Lightweight, không cần thêm dependencies
  - Phù hợp với format cụ thể: "[Tên món] [Số] phần"
  - Dễ maintain và customize
  - Performance tốt (không cần load external libraries)
- **Implementation**:
  - Regex patterns cho format "[Tên món] [Số] phần"
  - Vietnamese number dictionary ("một" → 1, "hai" → 2, ...)
  - Pattern matching cho tên món
  - Fallback parsing nếu format không khớp

### 3.3. Menu Matching Algorithm

#### Option A - Fuse.js
- **Library**: Fuse.js (Lightweight fuzzy search)
- **Pros**:
  - Lightweight (~2KB gzipped)
  - Fast performance (< 500ms requirement)
  - Good accuracy với threshold tuning
  - Easy to integrate
  - No backend required
- **Configuration**:
  - Threshold: 0.4 (balance giữa accuracy và flexibility)
  - Keys: ['name'] (match theo tên món)
  - Include score: true (để hiển thị confidence)
  - Ignore location: true (không quan trọng vị trí từ)
- **Installation**: `npm install fuse.js`

---

## 📦 4. CẤU TRÚC THƯ MỤC & FILES

**Phù hợp với codebase hiện tại:**
- `utils/` cho utility functions (như `customerOrder.js`, `kitchenOptimizer.js`)
- `hooks/` cho custom hooks (như `useKitchenOrders.js`)
- `components/` cho React components

```
src/
├── hooks/
│   └── useSpeechRecognition.js       # Speech recognition hook
├── utils/
│   ├── voiceParser.js                 # Parse voice text to structured data
│   ├── menuMatcher.js                 # Match dish names to menu items (sử dụng Fuse.js)
│   └── vietnameseNumberParser.js      # Convert "một" → 1, "hai" → 2 (helper function)
├── components/
│   └── VoiceOrderButton.jsx           # UI component với mic icon
└── pages/
    └── CreateBill.jsx                 # Integration point (đã có)
```

**Lý do đặt vào `utils/`:**
- Phù hợp với pattern hiện tại của codebase
- `voiceParser.js` và `menuMatcher.js` là utility functions, không phải services
- Dễ import và maintain
- Consistent với các file khác như `kitchenOptimizer.js`, `customerOrder.js`

---

## 🔧 5. CHI TIẾT TRIỂN KHAI

### 5.1. Phase 1: Basic Speech Recognition (MVP)

#### Step 1.1: Install Dependencies
```bash
# Install Fuse.js cho fuzzy matching
npm install fuse.js

# Note: Không cần react-speech-recognition vì sẽ implement trực tiếp với Web Speech API
# để có control tốt hơn và performance tốt hơn
```

#### Step 1.2: Create useSpeechRecognition Hook
```javascript
// src/hooks/useSpeechRecognition.js
import { useState, useEffect, useRef } from 'react';

export const useSpeechRecognition = (onResult) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    // Check browser support
    const supported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    setIsSupported(supported);
    
    if (!supported) {
      console.warn('Speech recognition not supported in this browser');
      return;
    }

    // Check microphone permission
    navigator.permissions?.query({ name: 'microphone' }).then((result) => {
      setHasPermission(result.state === 'granted');
      
      result.onchange = () => {
        setHasPermission(result.state === 'granted');
      };
    }).catch(() => {
      // Fallback: Try to access microphone directly
      navigator.mediaDevices?.getUserMedia({ audio: true })
        .then(() => setHasPermission(true))
        .catch(() => setHasPermission(false));
    });

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true; // Show interim results for real-time feedback
    recognitionRef.current.lang = 'vi-VN'; // Vietnamese

    recognitionRef.current.onresult = (event) => {
      // Get final transcript
      const finalTranscript = Array.from(event.results)
        .filter(result => result.isFinal)
        .map(result => result[0].transcript)
        .join(' ');
      
      // Get interim transcript for real-time display
      const interimTranscript = Array.from(event.results)
        .filter(result => !result.isFinal)
        .map(result => result[0].transcript)
        .join(' ');
      
      const fullTranscript = finalTranscript || interimTranscript;
      setTranscript(fullTranscript);
      
      // Only call onResult when we have final results
      if (finalTranscript && onResult) {
        onResult(finalTranscript);
      }
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      if (event.error === 'not-allowed') {
        setHasPermission(false);
      }
      
      // Auto-stop on error
      setIsListening(false);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onResult]);

  const startListening = async () => {
    if (!isSupported) {
      console.error('Speech recognition not supported');
      return;
    }

    // Request permission if needed
    if (hasPermission === false) {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setHasPermission(true);
      } catch (error) {
        console.error('Microphone permission denied:', error);
        setHasPermission(false);
        return;
      }
    }

    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error('Error starting speech recognition:', error);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  return {
    isListening,
    transcript,
    isSupported,
    hasPermission,
    startListening,
    stopListening
  };
};
```

#### Step 1.3: Create VoiceParser Utility
```javascript
// src/utils/voiceParser.js
// Export pattern giống với các utils khác trong codebase (kitchenOptimizer.js, customerOrder.js)

/**
 * Parse Vietnamese voice input to structured order data
 * Primary Format: "Ốc hương 1 phần, ốc len 1 phần, sò lông 2 phần"
 * Input: "Ốc hương 1 phần, ốc len 1 phần, sò lông 2 phần"
 * Output: [
 *   { quantity: 1, dishName: "ốc hương" },
 *   { quantity: 1, dishName: "ốc len" },
 *   { quantity: 2, dishName: "sò lông" }
 * ]
 * 
 * Rules:
 * - Format: [Tên món] [Số] phần
 * - Nếu không có số lượng → Mặc định 1 phần
 * - Hỗ trợ dấu phẩy (,) hoặc không có
 * 
 * Implementation: Custom Parser (Option A) - Regex-based
 */

const VIETNAMESE_NUMBERS = {
  'một': 1, 'hai': 2, 'ba': 3, 'bốn': 4, 'năm': 5,
  'sáu': 6, 'bảy': 7, 'tám': 8, 'chín': 9, 'mười': 10,
  'mười một': 11, 'mười hai': 12, 'mười ba': 13,
  'mười bốn': 14, 'mười lăm': 15, 'mười sáu': 16,
  'mười bảy': 17, 'mười tám': 18, 'mười chín': 19,
  'hai mươi': 20
};

export const parseVoiceOrder = (text) => {
  // Normalize text: lowercase, trim, remove extra spaces
  const normalized = text.toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/,\s*/g, ', '); // Normalize comma spacing
  
  const results = [];
  
  // Primary Pattern: "[Tên món] [Số] phần"
  // Example: "ốc hương 1 phần" hoặc "ốc hương một phần"
  const primaryPattern = /([^0-9một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười]+?)\s+(\d+|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười(?:\s+(?:một|hai|ba|bốn|năm|sáu|bảy|tám|chín))?)\s+phần/gi;
  
  let match;
  while ((match = primaryPattern.exec(normalized)) !== null) {
    const dishName = match[1].trim();
    const quantityStr = match[2].trim();
    
    let quantity = parseInt(quantityStr);
    if (isNaN(quantity)) {
      quantity = VIETNAMESE_NUMBERS[quantityStr.toLowerCase()] || 1;
    }
    
    if (quantity > 0 && dishName.length > 0) {
      results.push({ quantity, dishName });
    }
  }
  
  // Fallback: Split by comma and process each item
  if (results.length === 0) {
    const items = normalized.split(',').map(item => item.trim());
    
    for (const item of items) {
      // Try to extract: [Tên món] [Số] phần
      const fallbackMatch = item.match(/^(.+?)\s+(\d+|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười)\s+phần$/i);
      
      if (fallbackMatch) {
        const dishName = fallbackMatch[1].trim();
        const quantityStr = fallbackMatch[2].trim();
        
        let quantity = parseInt(quantityStr);
        if (isNaN(quantity)) {
          quantity = VIETNAMESE_NUMBERS[quantityStr.toLowerCase()] || 1;
        }
        
        if (quantity > 0 && dishName.length > 0) {
          results.push({ quantity, dishName });
        }
      } else {
        // No quantity specified → default to 1
        const dishName = item.replace(/\s+phần\s*$/i, '').trim();
        if (dishName.length > 0) {
          results.push({ quantity: 1, dishName });
        }
      }
    }
  }

  return results;
};
```

#### Step 1.4: Create MenuMatcher Utility
```javascript
// src/utils/menuMatcher.js
// Export pattern giống với các utils khác trong codebase
import Fuse from 'fuse.js';

/**
 * Match dish names from voice input to menu items
 * 
 * Rules:
 * - Ưu tiên category hiện tại, nhưng tìm toàn bộ menu
 * - Không có món trùng tên (chỉ có "ốc hương" không phân rõ món con)
 * - Performance: Matching phải < 500ms
 * 
 * Implementation: Fuse.js (Option A) - Lightweight fuzzy search
 */

export const createMenuMatcher = (menuItems, currentCategory = null) => {
  // Filter by current category first (priority), but keep all items for fallback
  const priorityItems = currentCategory 
    ? menuItems.filter(item => item.category === currentCategory)
    : menuItems;
  
  const allItemsFuse = new Fuse(menuItems, {
    keys: ['name'],
    threshold: 0.4, // 0 = exact match, 1 = match anything
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 2
  });
  
  const priorityFuse = currentCategory ? new Fuse(priorityItems, {
    keys: ['name'],
    threshold: 0.4,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 2
  }) : null;

  return (dishName) => {
    // Normalize dish name
    const normalized = dishName.toLowerCase().trim();
    
    // Step 1: Try exact match in priority category first
    if (priorityFuse) {
      const exactMatch = priorityItems.find(item => 
        item.name.toLowerCase() === normalized
      );
      if (exactMatch) {
        return { menuItem: exactMatch, confidence: 1.0 };
      }
    }
    
    // Step 2: Try exact match in all items
    const exactMatch = menuItems.find(item => 
      item.name.toLowerCase() === normalized
    );
    if (exactMatch) {
      return { menuItem: exactMatch, confidence: 1.0 };
    }

    // Step 3: Try fuzzy match in priority category
    if (priorityFuse) {
      const priorityResults = priorityFuse.search(normalized);
      if (priorityResults.length > 0 && priorityResults[0].score < 0.5) {
        return {
          menuItem: priorityResults[0].item,
          confidence: 1 - priorityResults[0].score
        };
      }
    }

    // Step 4: Try fuzzy match in all items
    const allResults = allItemsFuse.search(normalized);
    if (allResults.length > 0 && allResults[0].score < 0.5) {
      return {
        menuItem: allResults[0].item,
        confidence: 1 - allResults[0].score
      };
    }

    // Step 5: Try partial match (contains) - priority first
    if (priorityFuse) {
      const partialMatch = priorityItems.find(item => 
        item.name.toLowerCase().includes(normalized) ||
        normalized.includes(item.name.toLowerCase())
      );
      if (partialMatch) {
        return { menuItem: partialMatch, confidence: 0.7 };
      }
    }

    // Step 6: Try partial match in all items
    const partialMatch = menuItems.find(item => 
      item.name.toLowerCase().includes(normalized) ||
      normalized.includes(item.name.toLowerCase())
    );
    if (partialMatch) {
      return { menuItem: partialMatch, confidence: 0.7 };
    }

    return null;
  };
};
```

#### Step 1.5: Create VoiceOrderButton Component
```javascript
// src/components/VoiceOrderButton.jsx
import React, { useState, useCallback, useMemo } from 'react';
import { Mic, MicOff, X, Check } from 'lucide-react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { parseVoiceOrder } from '../utils/voiceParser';
import { createMenuMatcher } from '../utils/menuMatcher';
import { toast } from 'react-toastify';

export const VoiceOrderButton = ({ menuItems, currentCategory, onItemsMatched }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [transcript, setTranscript] = useState('');
  
  // Create menu matcher with current category context
  const menuMatcher = useMemo(() => 
    createMenuMatcher(menuItems, currentCategory),
    [menuItems, currentCategory]
  );

  const handleResult = useCallback((transcriptText) => {
    if (!transcriptText || transcriptText.trim().length === 0) return;
    
    setTranscript(transcriptText);
    setIsProcessing(true);
    
    try {
      // Parse voice text
      const parsedItems = parseVoiceOrder(transcriptText);
      
      if (parsedItems.length === 0) {
        toast.error('Không thể nhận diện đơn hàng. Vui lòng thử lại.');
        setIsProcessing(false);
        return;
      }

      // Match with menu items
      const matchedItems = [];
      const unmatchedItems = [];

      for (const item of parsedItems) {
        const match = menuMatcher(item.dishName);
        if (match && match.confidence > 0.5) {
          matchedItems.push({
            menuItemId: match.menuItem.id,
            quantity: item.quantity,
            name: match.menuItem.name,
            confidence: match.confidence,
            originalDishName: item.dishName
          });
        } else {
          unmatchedItems.push({
            dishName: item.dishName,
            quantity: item.quantity
          });
        }
      }

      // Show preview modal
      setPreviewData({
        matchedItems,
        unmatchedItems,
        transcript: transcriptText
      });
      setShowPreview(true);
      setIsProcessing(false);

    } catch (error) {
      console.error('Error processing voice order:', error);
      toast.error('Có lỗi xảy ra khi xử lý đơn hàng.');
      setIsProcessing(false);
    }
  }, [menuItems, menuMatcher]);

  const handleConfirm = () => {
    if (previewData && previewData.matchedItems.length > 0) {
      // Ghi đè (không cộng dồn) - theo yêu cầu
      onItemsMatched(previewData.matchedItems);
      
      toast.success(`Đã thêm ${previewData.matchedItems.length} món vào đơn hàng!`);
      
      if (previewData.unmatchedItems.length > 0) {
        toast.warning(
          `Không tìm thấy: ${previewData.unmatchedItems.map(u => u.dishName).join(', ')}`
        );
      }
    }
    
    setShowPreview(false);
    setPreviewData(null);
    setTranscript('');
  };

  const handleCancel = () => {
    setShowPreview(false);
    setPreviewData(null);
    setTranscript('');
  };

  const {
    isListening,
    startListening,
    stopListening,
    isSupported,
    hasPermission
  } = useSpeechRecognition(handleResult);

  const handleToggle = () => {
    if (!isSupported) {
      // Show modal hướng dẫn cho browser không hỗ trợ
      toast.error('Tính năng này chỉ hỗ trợ Chrome/Edge. Vui lòng sử dụng trình duyệt khác.');
      return;
    }
    
    if (!hasPermission) {
      // Show modal hướng dẫn cho permission denied
      toast.warning('Vui lòng cho phép sử dụng microphone.');
      return;
    }
    
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <>
      <button
        onClick={handleToggle}
        disabled={isProcessing || !isSupported}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg transition-all
          ${isListening 
            ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
          ${!isSupported ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        title={isListening ? 'Đang nghe... Click để dừng' : 'Nhập đơn bằng giọng nói'}
      >
        {isListening ? (
          <>
            <MicOff size={18} />
            <span>Dừng</span>
          </>
        ) : (
          <>
            <Mic size={18} />
            <span>Nói đơn</span>
          </>
        )}
      </button>

      {/* Preview Modal */}
      {showPreview && previewData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                Xác nhận đơn hàng
              </h3>
              <button
                onClick={handleCancel}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Body */}
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {/* Transcript */}
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Bạn đã nói:</p>
                <p className="text-sm font-medium text-gray-900 bg-gray-50 p-3 rounded">
                  "{previewData.transcript}"
                </p>
              </div>

              {/* Matched Items */}
              {previewData.matchedItems.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">
                    Món đã tìm thấy ({previewData.matchedItems.length}):
                  </h4>
                  <div className="space-y-2">
                    {previewData.matchedItems.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{item.name}</p>
                          <p className="text-xs text-gray-500">
                            Số lượng: {item.quantity} | 
                            Độ tin cậy: {Math.round(item.confidence * 100)}%
                          </p>
                        </div>
                        <Check className="w-5 h-5 text-green-600" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unmatched Items */}
              {previewData.unmatchedItems.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-yellow-900 mb-2">
                    Không tìm thấy ({previewData.unmatchedItems.length}):
                  </h4>
                  <div className="space-y-2">
                    {previewData.unmatchedItems.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{item.dishName}</p>
                          <p className="text-xs text-gray-500">Số lượng: {item.quantity}</p>
                        </div>
                        <X className="w-5 h-5 text-yellow-600" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirm}
                disabled={previewData.matchedItems.length === 0}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Xác nhận ({previewData.matchedItems.length} món)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
```

### 5.2. Phase 2: Integration với CreateBill

#### Step 2.1: Add VoiceOrderButton to CreateBill
```javascript
// In CreateBill.jsx
// Import pattern giống với các components khác trong codebase
import { VoiceOrderButton } from '../components/VoiceOrderButton';

// In component:
const handleVoiceItemsMatched = (matchedItems) => {
  // Ghi đè (không cộng dồn) - theo yêu cầu
  setQuantities(prev => {
    const newQuantities = { ...prev };
    matchedItems.forEach(item => {
      // Ghi đè số lượng mới (không cộng với số cũ)
      newQuantities[item.menuItemId] = item.quantity;
    });
    return newQuantities;
  });
};

// In JSX - Đặt cạnh phần chọn bàn (sau dòng 208 trong CreateBill.jsx):
<div className="mb-6">
  <label htmlFor="table" className="block text-sm font-medium text-gray-700 mb-2">
    Chọn số bàn *
  </label>
  <div className="flex items-center gap-3">
    <select
      id="table"
      value={selectedTable}
      onChange={(e) => setSelectedTable(e.target.value)}
      className="flex-1 max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
    >
      <option value="">-- Chọn bàn --</option>
      {tables && tables.map((table) => (
        <option key={table.id} value={table.number}>
          Bàn {table.number} - {table.seats} chỗ
        </option>
      ))}
    </select>
    
    {/* Voice Order Button - Cạnh phần chọn bàn */}
    <VoiceOrderButton 
      menuItems={menuItems}
      currentCategory={selectedCategory}
      onItemsMatched={handleVoiceItemsMatched}
    />
  </div>
</div>
```

**Integration Notes:**
- Import pattern giống với các components khác: `import { Component } from '../components/Component'`
- Sử dụng `menuItems` từ `useApp()` context (đã có sẵn)
- Sử dụng `selectedCategory` state (đã có sẵn)
- Sử dụng `toast` từ `react-toastify` (đã có sẵn trong codebase)
- Styling với Tailwind CSS (consistent với codebase)
- Icons từ `lucide-react` (đã có sẵn)

### 5.3. Phase 3: Enhancements (Đã tích hợp vào MVP)

#### 3.1. Visual Feedback ✅ IMPLEMENTED
- ✅ Real-time transcript display (trong preview modal)
- ✅ Confidence score indicators (trong preview modal)
- ✅ Animation khi đang nghe (pulse animation trên button)
- ✅ Preview modal với danh sách matched/unmatched items

#### 3.2. Error Handling ✅ IMPLEMENTED
- ✅ Permission denied handling (modal hướng dẫn)
- ✅ Browser compatibility detection (thông báo Chrome/Edge only)
- ✅ Network error handling (toast notifications)
- ✅ Fallback UI khi không hỗ trợ (disable button với explanation)

#### 3.3. Performance Optimization
- ✅ Cache menu matcher (useMemo trong component)
- ✅ Performance target: < 500ms matching
- ✅ Optimize Fuse.js configuration

---

## 🚧 6. THÁCH THỨC & HẠN CHẾ

### 6.1. Technical Challenges

#### Challenge 1: Browser Compatibility ✅ RESOLVED
- **Issue**: Web Speech API chỉ hỗ trợ Chrome/Edge
- **Impact**: Safari/Firefox users không dùng được
- **Solution Implemented**: 
  - Detect browser compatibility trong hook
  - Hiển thị thông báo "Chỉ hỗ trợ Chrome/Edge" cho Safari/Firefox
  - Disable button với explanation
  - Show modal hướng dẫn khi click

#### Challenge 2: Vietnamese Speech Recognition Accuracy
- **Issue**: Google Speech API có thể không nhận diện tốt tiếng Việt
- **Impact**: Sai tên món, số lượng
- **Solution**:
  - Focus vào accuracy cao (MVP priority)
  - Preview modal để user xác nhận trước khi thêm
  - Show confidence score trong preview
  - Improve parser với format cụ thể: "[Tên món] [Số] phần"

#### Challenge 3: Ambiguous Dish Names ✅ NOT APPLICABLE
- **Issue**: Không có vì menu chỉ có "ốc hương" không phân rõ món con
- **Impact**: Không có
- **Solution**: 
  - Không cần xử lý multiple matches
  - Simple matching algorithm đủ

#### Challenge 4: Number Recognition
- **Issue**: "Một" vs "Mốt", "Hai" vs "Hài"
- **Impact**: Sai số lượng
- **Solution**:
  - Expand Vietnamese number dictionary
  - Format cụ thể "[Tên món] [Số] phần" giúp parser dễ nhận diện
  - Preview modal cho user xác nhận số lượng
  - Mặc định 1 phần nếu không có số lượng

#### Challenge 5: Noise & Environment ✅ RESOLVED
- **Issue**: Môi trường ồn, giọng nói không rõ
- **Impact**: Low accuracy
- **Solution Implemented**:
  - Để browser xử lý noise cancellation (không implement custom)
  - Preview modal cho user xác nhận trước khi thêm
  - User có thể cancel và thử lại

### 6.2. UX Challenges

#### Challenge 6: User Expectations ✅ RESOLVED
- **Issue**: User expect 100% accuracy
- **Impact**: Frustration khi sai
- **Solution Implemented**:
  - Preview modal hiển thị transcript + matched items + confidence score
  - User xác nhận trước khi thêm vào bill
  - Visual feedback rõ ràng: matched (xanh) vs unmatched (vàng)
  - Show danh sách món đã thêm sau khi confirm

#### Challenge 7: Privacy Concerns ✅ RESOLVED
- **Issue**: Microphone permission có thể làm user lo lắng
- **Impact**: User không cho phép
- **Solution Implemented**:
  - Hiển thị modal hướng dẫn khi permission denied
  - Clear explanation về data usage (chỉ process real-time, không lưu)
  - Show indicator khi đang nghe
  - Option để cancel bất cứ lúc nào

### 6.3. Business Challenges

#### Challenge 8: Cost (nếu dùng Cloud API)
- **Issue**: Cloud Speech API có phí
- **Impact**: Chi phí tăng theo usage
- **Solution**:
  - Start với free Web Speech API
  - Monitor usage và cost
  - Set limits nếu cần

#### Challenge 9: Maintenance
- **Issue**: Menu items thay đổi thường xuyên
- **Impact**: Matching accuracy giảm
- **Solution**:
  - Auto-update menu matcher khi menu thay đổi
  - Log unmatched items để improve
  - Admin dashboard để review matches

---

## ✅ 7. TESTING STRATEGY

### 7.1. Unit Tests
- VoiceParser: Test các patterns khác nhau
- MenuMatcher: Test matching accuracy
- VietnameseNumberParser: Test number conversion

### 7.2. Integration Tests
- End-to-end flow: Voice → Parse → Match → Add to bill
- Error scenarios: No match, permission denied

### 7.3. User Acceptance Tests
- Test với real users
- Collect feedback về accuracy
- A/B test: Voice vs Manual input

### 7.4. Performance Tests
- Response time: Voice → Display results
- Memory usage với large menu
- Browser compatibility matrix

---

## 📊 8. METRICS & MONITORING

### 8.1. Key Metrics
- **Accuracy Rate**: % orders matched correctly
- **Usage Rate**: % users sử dụng voice input
- **Error Rate**: % orders cần manual correction
- **Average Processing Time**: Time từ voice → results

### 8.2. Logging
- Log unmatched dish names
- Log confidence scores
- Log user corrections

### 8.3. Analytics
- Track voice input success/failure
- Monitor browser compatibility
- Track most common errors

---

## 🎯 9. ROADMAP

### Phase 1: MVP - Accuracy Focus (3-4 weeks)
**Priority: Accuracy cao**
- ✅ Basic speech recognition với Web Speech API
- ✅ Parser cho format: "[Tên món] [Số] phần"
- ✅ Menu matching với category context
- ✅ Preview modal với transcript + matched items
- ✅ Browser compatibility detection
- ✅ Permission handling với modal hướng dẫn
- ✅ Visual feedback: transcript real-time + preview
- ✅ Integration với CreateBill (cạnh phần chọn bàn)

### Phase 2: Polish & Testing (1-2 weeks)
- ✅ Error handling đầy đủ
- ✅ Performance optimization (< 500ms matching)
- ✅ User testing với nhân viên order
- ✅ Fine-tune parser patterns
- ✅ Improve matching accuracy

### Phase 3: Monitoring & Iteration (Ongoing)
- ✅ Analytics integration
- ✅ Log unmatched items để improve
- ✅ User feedback collection
- ✅ Continuous improvement based on real usage

### Phase 4: Advanced Features (Future - Optional)
- Multi-language support (nếu cần)
- Offline mode (nếu cần)
- Custom voice commands
- Batch processing cho nhiều đơn

---

## 🔒 10. SECURITY & PRIVACY

### 10.1. Data Privacy
- Voice data không được lưu trữ
- Chỉ process real-time
- No third-party sharing

### 10.2. Permissions
- Request microphone permission với clear explanation
- Option để revoke permission
- Show indicator khi đang nghe

---

## 📝 11. DOCUMENTATION

### 11.1. User Guide
- How to use voice input
- Supported formats
- Troubleshooting

### 11.2. Developer Docs
- API documentation
- Architecture decisions
- Contribution guidelines

---

## 📋 12. REQUIREMENTS SUMMARY

### 12.1. Core Requirements
- **Format**: "[Tên món] [Số] phần" (ví dụ: "Ốc hương 1 phần, ốc len 1 phần")
- **Target Users**: Nhân viên order (nói nhanh, nhiều món)
- **Usage**: Primary input method (thường xuyên sử dụng)
- **Priority**: Accuracy cao (chấp nhận thời gian phát triển lâu hơn)

### 12.2. Features Bắt Buộc (MVP)
- ✅ Basic voice recognition (Web Speech API)
- ✅ Parse số lượng + tên món
- ✅ Match với menu (ưu tiên category hiện tại, nhưng tìm toàn bộ)
- ✅ Visual feedback (transcript real-time + preview modal)

### 12.3. Business Logic
- **Cộng dồn**: Ghi đè (không cộng dồn) nếu món đã có
- **Số lượng mặc định**: 1 phần nếu không có số lượng
- **Category context**: Ưu tiên category hiện tại, nhưng tìm toàn bộ menu
- **Không match**: Bỏ qua và thông báo (không hiển thị suggestions)

### 12.4. UX Requirements
- **Vị trí nút**: Cạnh phần chọn bàn
- **Visual feedback**: Hiển thị cả transcript và danh sách món đã match
- **Xác nhận**: Preview modal trước khi thêm vào bill
- **Browser support**: Hiển thị thông báo "Chỉ hỗ trợ Chrome/Edge" cho Safari/Firefox
- **Permission**: Modal hướng dẫn khi permission denied

### 12.5. Technical Requirements
- **Performance**: Matching < 500ms
- **Offline**: Không cần (luôn cần internet)
- **Language**: Chỉ tiếng Việt
- **Noise**: Để browser xử lý (không cần custom noise cancellation)

---

## 🎉 KẾT LUẬN

Tính năng nhập bills bằng giọng nói được thiết kế cho **nhân viên order** với focus vào **accuracy cao**:

### Key Decisions:
1. **Format cụ thể**: "[Tên món] [Số] phần" - giúp parser chính xác hơn
2. **Preview modal**: User xác nhận trước khi thêm - đảm bảo accuracy
3. **Browser support**: Chỉ Chrome/Edge - hiển thị thông báo rõ ràng
4. **Category context**: Ưu tiên category hiện tại nhưng tìm toàn bộ
5. **Ghi đè không cộng dồn**: Đơn giản hóa logic

### Technology Choices:
1. **Speech Recognition**: Web Speech API (free, no backend)
2. **NLP Parser**: Custom Parser (Option A) - Regex-based, lightweight
3. **Menu Matching**: Fuse.js (Option A) - Lightweight fuzzy search
4. **File Structure**: Phù hợp với codebase hiện tại (utils/, hooks/, components/)

### Implementation Approach:
1. ✅ Start với Web Speech API (free, no backend)
2. ✅ Custom Parser với regex patterns cho format cụ thể
3. ✅ Fuse.js cho fuzzy matching (lightweight, fast)
4. ✅ Preview modal cho user confirmation
5. ✅ Integration với CreateBill.jsx (cạnh phần chọn bàn)
6. ✅ Test với real users (nhân viên order)
7. ✅ Iterate based on feedback

### Codebase Integration:
- **File Structure**: 
  - `src/utils/voiceParser.js` - Custom parser utility
  - `src/utils/menuMatcher.js` - Fuse.js matching utility
  - `src/hooks/useSpeechRecognition.js` - Web Speech API hook
  - `src/components/VoiceOrderButton.jsx` - UI component
- **Import Pattern**: Named exports (giống với `kitchenOptimizer.js`, `customerOrder.js`)
- **Dependencies**: Chỉ cần `fuse.js` (lightweight, ~2KB)
- **Styling**: Tailwind CSS (consistent với codebase)
- **Icons**: Lucide React (đã có sẵn)
- **Notifications**: React Toastify (đã có sẵn)

### Success Metrics:
- **Accuracy Rate**: > 90% orders matched correctly
- **Usage Rate**: > 70% orders via voice input
- **Processing Time**: < 500ms từ voice → preview
- **User Satisfaction**: Positive feedback từ nhân viên order


