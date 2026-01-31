/**
 * Parse Vietnamese voice input to structured order data
 * Primary Format: "Ốc hương 1 phần, ốc len 1 phần, sò lông 2 phần"
 * 
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

/**
 * Convert Vietnamese number string to number
 * @param {string} numStr - Vietnamese number string
 * @returns {number} - Numeric value, default to 1 if not found
 */
const parseVietnameseNumber = (numStr) => {
  try {
    if (!numStr || typeof numStr !== 'string') {
      return 1;
    }
    const normalized = numStr.toLowerCase().trim();
    if (VIETNAMESE_NUMBERS[normalized]) {
      return VIETNAMESE_NUMBERS[normalized];
    }
    const parsed = parseInt(normalized);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
    return 1;
  } catch (error) {
    console.warn('Error parsing Vietnamese number:', numStr, error);
    return 1;
  }
};

/**
 * Clean text: Remove noise words and normalize
 * @param {string} text - Raw text
 * @returns {string} - Cleaned text
 */
const cleanText = (text) => {
  // Remove common noise words/phrases
  // Note: Punctuation marks (?, !, .) are handled separately, not in noiseWords
  const noiseWords = [
    'chưa', 'phẩy', 'phải', 'được', 'ạ', 'ơi', 'nhé', 'nhỉ'
  ];
  
  let cleaned = text.toLowerCase()
    .trim()
    .replace(/[,]+/g, ' ') // Replace commas with space (bỏ dấu phẩy)
    .replace(/[.!?]+/g, ' ') // Replace other punctuation with space
    .replace(/\s+/g, ' '); // Normalize spaces
  
  // Remove noise words (escape special regex characters)
  noiseWords.forEach(word => {
    try {
      // Escape special regex characters in the word
      const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
      cleaned = cleaned.replace(regex, '');
    } catch (error) {
      console.warn(`Error creating regex for noise word "${word}":`, error);
      // Fallback: simple string replacement
      const wordRegex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      cleaned = cleaned.replace(wordRegex, '');
    }
  });
  
  return cleaned.trim().replace(/\s+/g, ' ');
};

/**
 * Parse voice order text to structured data
 * @param {string} text - Voice input text
 * @returns {Array<{quantity: number, dishName: string}>} - Parsed items
 */
export const parseVoiceOrder = (text) => {
  try {
    if (!text || typeof text !== 'string') {
      return [];
    }

    // Clean text first
    let cleaned;
    try {
      cleaned = cleanText(text);
    } catch (cleanError) {
      console.error('Error cleaning text:', cleanError);
      // Fallback: basic cleaning
      cleaned = text.toLowerCase().trim().replace(/\s+/g, ' ');
    }
    
    if (!cleaned || cleaned.length === 0) {
      return [];
    }
    
    const results = [];
    const usedIndices = new Set();
  
  // Pattern 1: "[Số] phần [Tên món]" - Số lượng ở trước
  // Example: "một phần ốc hương", "1 phần sò điệp"
  let pattern1;
  try {
    pattern1 = /(\d+|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười(?:\s+(?:một|hai|ba|bốn|năm|sáu|bảy|tám|chín))?)\s+phần\s+([^\d]+?)(?=\s+(?:\d+|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười)\s+phần|$)/gi;
  } catch (regexError) {
    console.error('Error creating regex pattern1:', regexError);
    pattern1 = null;
  }
  
  if (pattern1) {
    let match;
    let iterations = 0;
    const maxIterations = 100; // Prevent infinite loops
    
    while ((match = pattern1.exec(cleaned)) !== null && iterations < maxIterations) {
      iterations++;
      const startIndex = match.index;
      const endIndex = startIndex + match[0].length;
      
      // Skip if overlaps
      let overlaps = false;
      for (const used of usedIndices) {
        if (startIndex < used.end && endIndex > used.start) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;
      
      const quantityStr = match[1].trim();
      let dishName = match[2].trim();
      
      // Remove trailing punctuation and clean
      dishName = dishName.replace(/[.\s]+$/, '').trim();
      
      // Skip if dish name is too short or contains only noise
      if (dishName.length < 2 || /^(g|h|i|j|k|l|m|n|o|p|q|r|s|t|u|v|w|x|y|z)$/i.test(dishName)) {
        continue;
      }
      
      let quantity = parseInt(quantityStr);
      if (isNaN(quantity)) {
        quantity = parseVietnameseNumber(quantityStr);
      }
      
      if (quantity > 0 && dishName.length >= 2) {
        results.push({ quantity, dishName });
        usedIndices.add({ start: startIndex, end: endIndex });
      }
    }
  }
  
  // Fallback: Nếu không match được gì, thử parse lại với logic đơn giản hơn
  // Chỉ xử lý format: "[Tên món] [Số] phần" hoặc "[Số] phần [Tên món]"
  // Không xử lý dấu phẩy - đơn giản hóa logic
  if (results.length === 0) {
    // Thử Pattern 1: [Số] phần [Tên món]
    let fallbackMatch = cleaned.match(/^(\d+|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười)\s+phần\s+(.+)$/i);
    
    if (fallbackMatch) {
      const quantityStr = fallbackMatch[1].trim();
      let dishName = fallbackMatch[2].trim();
      
      dishName = dishName.replace(/[.\s]+$/, '').trim();
      
      if (dishName.length >= 2) {
        let quantity = parseInt(quantityStr);
        if (isNaN(quantity)) {
          quantity = parseVietnameseNumber(quantityStr);
        }
        
        if (quantity > 0) {
          results.push({ quantity, dishName });
        }
      }
    } else {
      // Thử Pattern 2: [Tên món] [Số] phần
      fallbackMatch = cleaned.match(/^(.+?)\s+(\d+|một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười)\s+phần$/i);
      
      if (fallbackMatch) {
        let dishName = fallbackMatch[1].trim();
        const quantityStr = fallbackMatch[2].trim();
        
        dishName = dishName.replace(/[.\s]+$/, '').trim();
        
        if (dishName.length >= 2) {
          let quantity = parseInt(quantityStr);
          if (isNaN(quantity)) {
            quantity = parseVietnameseNumber(quantityStr);
          }
          
          if (quantity > 0) {
            results.push({ quantity, dishName });
          }
        }
      }
    }
  }

    // Remove duplicates and filter out invalid items
    const uniqueResults = [];
    const seen = new Set();
    
    for (const item of results) {
      try {
        if (!item || typeof item !== 'object' || !item.dishName) {
          continue;
        }
        
        const key = `${item.dishName.toLowerCase()}_${item.quantity}`;
        if (!seen.has(key) && item.dishName.length >= 2) {
          seen.add(key);
          uniqueResults.push({
            quantity: item.quantity || 1,
            dishName: item.dishName.trim()
          });
        }
      } catch (itemError) {
        console.warn('Error processing item:', item, itemError);
        continue;
      }
    }

    console.log('[voiceParser] Final parsed results:', uniqueResults);
    return uniqueResults;
  } catch (error) {
    console.error('Error in parseVoiceOrder:', error);
    console.error('Input text:', text);
    // Return empty array on error instead of crashing
    return [];
  }
};

