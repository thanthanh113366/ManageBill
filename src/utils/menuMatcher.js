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

import Fuse from 'fuse.js';

/**
 * Create a menu matcher function with category context
 * @param {Array} menuItems - Array of menu items from Firestore
 * @param {string|null} currentCategory - Current selected category (optional)
 * @returns {Function} - Matcher function that takes dishName and returns match result
 */
export const createMenuMatcher = (menuItems, currentCategory = null) => {
  if (!menuItems || menuItems.length === 0) {
    return () => null;
  }

  // Filter by current category first (priority), but keep all items for fallback
  const priorityItems = currentCategory 
    ? menuItems.filter(item => item.category === currentCategory)
    : menuItems;
  
  // Create Fuse instances for fuzzy matching
  // Increased threshold to 0.5 for better accuracy (was 0.4)
  const allItemsFuse = new Fuse(menuItems, {
    keys: ['name'],
    threshold: 0.5, // 0 = exact match, 1 = match anything (increased for better accuracy)
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 2,
    findAllMatches: false, // Only get best match
    shouldSort: true
  });
  
  const priorityFuse = currentCategory && priorityItems.length > 0 ? new Fuse(priorityItems, {
    keys: ['name'],
    threshold: 0.5, // Increased for better accuracy
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 2,
    findAllMatches: false,
    shouldSort: true
  }) : null;

  /**
   * Match a dish name to menu items
   * @param {string} dishName - Dish name from voice input
   * @returns {{menuItem: Object, confidence: number}|null} - Match result or null
   */
  return (dishName) => {
    try {
      if (!dishName || typeof dishName !== 'string') {
        return null;
      }

      // Normalize dish name
      const normalized = dishName.toLowerCase().trim();
      
      if (normalized.length === 0) {
        return null;
      }
      
      console.log('[menuMatcher] Searching for:', normalized, 'in', menuItems.length, 'items');
    
    // Step 1: Try exact match in priority category first
    if (priorityFuse && priorityItems.length > 0) {
      const exactMatch = priorityItems.find(item => 
        item.name && item.name.toLowerCase() === normalized
      );
      if (exactMatch) {
        return { menuItem: exactMatch, confidence: 1.0 };
      }
    }
    
    // Step 2: Try exact match in all items
    const exactMatch = menuItems.find(item => 
      item.name && item.name.toLowerCase() === normalized
    );
    if (exactMatch) {
      return { menuItem: exactMatch, confidence: 1.0 };
    }

    // Step 3: Try fuzzy match in priority category
    if (priorityFuse && priorityItems.length > 0) {
      const priorityResults = priorityFuse.search(normalized);
      console.log('[menuMatcher] Priority fuzzy results:', priorityResults.length, priorityResults.slice(0, 3).map(r => ({ name: r.item.name, score: r.score })));
      if (priorityResults.length > 0 && priorityResults[0].score < 0.6) {
        const confidence = 1 - priorityResults[0].score;
        console.log('[menuMatcher] Priority match found:', priorityResults[0].item.name, 'confidence:', confidence);
        // Boost confidence for priority category matches
        return {
          menuItem: priorityResults[0].item,
          confidence: Math.min(confidence * 1.1, 1.0) // Boost by 10%
        };
      }
    }

    // Step 4: Try fuzzy match in all items
    const allResults = allItemsFuse.search(normalized);
    console.log('[menuMatcher] All items fuzzy results:', allResults.length, allResults.slice(0, 3).map(r => ({ name: r.item.name, score: r.score })));
    if (allResults.length > 0 && allResults[0].score < 0.6) {
      const confidence = 1 - allResults[0].score;
      console.log('[menuMatcher] All items match found:', allResults[0].item.name, 'confidence:', confidence);
      return {
        menuItem: allResults[0].item,
        confidence: confidence
      };
    }

    // Step 5: Try partial match (contains) - priority first
    // Only for longer dish names (>= 3 chars) to avoid false matches
    if (normalized.length >= 3 && priorityFuse && priorityItems.length > 0) {
      const partialMatch = priorityItems.find(item => {
        if (!item.name) return false;
        const itemName = item.name.toLowerCase();
        // Check if normalized is contained in item name or vice versa
        const containsMatch = itemName.includes(normalized) || normalized.includes(itemName);
        // Also check if key words match (for cases like "hào" -> "Hàu" or "Bào ngư")
        const wordsMatch = normalized.split(/\s+/).some(word => 
          word.length >= 2 && itemName.includes(word)
        );
        return containsMatch || wordsMatch;
      });
      if (partialMatch) {
        // Calculate confidence based on match quality
        const itemName = partialMatch.name.toLowerCase();
        let confidence = 0.6;
        if (itemName.includes(normalized) || normalized.includes(itemName)) {
          confidence = 0.75; // Higher confidence for direct contains
        }
        return { menuItem: partialMatch, confidence };
      }
    }

    // Step 6: Try partial match in all items
    // Only for longer dish names (>= 3 chars)
    if (normalized.length >= 3) {
      const partialMatch = menuItems.find(item => {
        if (!item.name) return false;
        const itemName = item.name.toLowerCase();
        const containsMatch = itemName.includes(normalized) || normalized.includes(itemName);
        const wordsMatch = normalized.split(/\s+/).some(word => 
          word.length >= 2 && itemName.includes(word)
        );
        return containsMatch || wordsMatch;
      });
      if (partialMatch) {
        const itemName = partialMatch.name.toLowerCase();
        let confidence = 0.6;
        if (itemName.includes(normalized) || normalized.includes(itemName)) {
          confidence = 0.75;
        }
        return { menuItem: partialMatch, confidence };
      }
    }
    
      // Step 7: Try word-based matching for short inputs (like "hào")
      // This helps with cases where user says "hào" which could be "Hàu" or "Bào ngư"
      if (normalized.length >= 2 && normalized.length <= 5) {
        const wordMatch = menuItems.find(item => {
          if (!item || !item.name) return false;
          try {
            const itemName = item.name.toLowerCase();
            // Check if any word in item name starts with or contains the normalized input
            const itemWords = itemName.split(/\s+/);
            return itemWords.some(word => 
              word.startsWith(normalized) || 
              normalized.startsWith(word) ||
              word.includes(normalized) ||
              normalized.includes(word)
            );
          } catch (e) {
            return false;
          }
        });
        if (wordMatch) {
          return { menuItem: wordMatch, confidence: 0.65 };
        }
      }

      return null;
    } catch (error) {
      console.error('Error in menuMatcher:', error);
      console.error('Dish name:', dishName);
      return null;
    }
  };
};

