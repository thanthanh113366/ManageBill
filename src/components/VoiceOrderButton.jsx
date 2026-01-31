import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Mic, MicOff, X, Check } from 'lucide-react';
import { useBackendWhisperRecognition } from '../hooks/useBackendWhisperRecognition';
import { parseVoiceOrder } from '../utils/voiceParser';
import { createMenuMatcher } from '../utils/menuMatcher';
import { toast } from 'react-toastify';

/**
 * Voice Order Button Component
 * Allows users to input orders via voice recognition using Backend Whisper API
 * 
 * Features:
 * - Record audio and send to backend API for transcription
 * - Frontend parses transcript and matches with menu items from Firebase
 * - Preview modal để xác nhận trước khi thêm
 * - Visual feedback với transcript và matched items
 * 
 * Props:
 * - menuItems: Array of menu items from Firebase
 * - currentCategory: Current selected category
 * - onItemsMatched: Callback when items are matched
 */
export const VoiceOrderButton = ({ menuItems, currentCategory, onItemsMatched }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [transcript, setTranscript] = useState('');
  const accumulatedTranscriptRef = useRef('');
  const processTimeoutRef = useRef(null);
  
  // Create menu matcher with current category context
  const menuMatcher = useMemo(() => {
    try {
      if (!menuItems || !Array.isArray(menuItems) || menuItems.length === 0) {
        console.warn('Menu items not available for matcher');
        return () => null; // Return a safe no-op function
      }
      return createMenuMatcher(menuItems, currentCategory);
    } catch (error) {
      console.error('Error creating menu matcher:', error);
      return () => null; // Return a safe no-op function
    }
  }, [menuItems, currentCategory]);

  // Xử lý đơn hàng từ accumulated transcript
  const handleProcessOrder = useCallback((fullTranscript) => {
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

      // Validate menuMatcher
      if (!menuMatcher || typeof menuMatcher !== 'function') {
        console.error('Menu matcher is not a function:', menuMatcher);
        toast.error('Lỗi hệ thống: Menu matcher không hợp lệ.');
        setIsProcessing(false);
        return;
      }

      // Parse voice text
      let parsedItems = [];
      try {
        parsedItems = parseVoiceOrder(fullTranscript);
      } catch (parseError) {
        console.error('Error parsing voice order:', parseError);
        toast.error('Lỗi khi phân tích đơn hàng. Vui lòng thử lại.');
        setIsProcessing(false);
        return;
      }
      
      if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
        toast.error('Không thể nhận diện đơn hàng. Vui lòng thử lại.');
        setIsProcessing(false);
        return;
      }

      // Match with menu items
      const matchedItems = [];
      const unmatchedItems = [];

      for (const item of parsedItems) {
        try {
          // Validate item structure
          if (!item || typeof item !== 'object' || !item.dishName || typeof item.dishName !== 'string') {
            console.warn('Invalid parsed item:', item);
            continue;
          }

          console.log('Matching dish:', item.dishName, 'quantity:', item.quantity);
          const match = menuMatcher(item.dishName);
          console.log('Match result:', match ? {
            name: match.menuItem?.name,
            confidence: match.confidence,
            id: match.menuItem?.id
          } : 'No match');
          
          // Validate match result
          if (match && 
              typeof match === 'object' && 
              match.menuItem && 
              match.menuItem.id && 
              match.confidence >= 0.5) {
            console.log('✓ Item matched:', item.dishName, '→', match.menuItem.name, `(confidence: ${match.confidence})`);
            matchedItems.push({
              menuItemId: match.menuItem.id,
              quantity: item.quantity || 1,
              name: match.menuItem.name || 'Unknown',
              confidence: match.confidence,
              originalDishName: item.dishName
            });
          } else {
            console.log('✗ Item NOT matched:', item.dishName, match ? `(confidence: ${match.confidence} < 0.5)` : '(no match found)');
            unmatchedItems.push({
              dishName: item.dishName,
              quantity: item.quantity || 1
            });
          }
        } catch (matchError) {
          console.error('Error matching item:', item, matchError);
          unmatchedItems.push({
            dishName: item.dishName || 'Unknown',
            quantity: item.quantity || 1
          });
        }
      }

      // Show preview modal even if no matches (user can see what was parsed)
      setPreviewData({
        matchedItems,
        unmatchedItems,
        transcript: fullTranscript
      });
      setShowPreview(true);
      setIsProcessing(false);

    } catch (error) {
      console.error('Error processing voice order:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        transcript: fullTranscript,
        menuItemsLength: menuItems?.length,
        menuMatcherType: typeof menuMatcher
      });
      toast.error(`Có lỗi xảy ra khi xử lý đơn hàng: ${error.message || 'Lỗi không xác định'}`);
      setIsProcessing(false);
    }
  }, [menuItems, menuMatcher]);
  
  // Handle transcript from backend API
  // Backend returns transcript, frontend parses and matches
  const handleResult = useCallback((transcriptText) => {
    if (!transcriptText || typeof transcriptText !== 'string' || transcriptText.trim().length === 0) {
      return;
    }
    
    console.log('Received transcript from backend:', transcriptText);
    
    // Process immediately - Backend already returns complete transcript
    handleProcessOrder(transcriptText);
  }, [handleProcessOrder]);
  
  // Cleanup timeout khi component unmount
  useEffect(() => {
    return () => {
      if (processTimeoutRef.current) {
        clearTimeout(processTimeoutRef.current);
      }
    };
  }, []);

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

  // Use Backend Whisper API
  const {
    isListening,
    transcript: liveTranscript,
    startListening,
    stopListening,
    isProcessing: isTranscribing,
    isConfigured
  } = useBackendWhisperRecognition(handleResult);

  const handleToggle = () => {
    if (!isConfigured) {
      toast.error('Backend API chưa được cấu hình. Vui lòng kiểm tra VITE_BACKEND_API_URL.');
      return;
    }
    
    if (isListening) {
      // Stop recording - Backend will auto-transcribe and call handleResult
      stopListening();
    } else {
      // Start recording
      accumulatedTranscriptRef.current = '';
      setTranscript('');
      startListening();
    }
  };

  return (
    <>
      <button
        onClick={handleToggle}
        disabled={isProcessing || isTranscribing}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg transition-all
          ${isListening 
            ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }
          ${isProcessing || isTranscribing ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        title={
          isTranscribing 
            ? 'Đang xử lý...' 
            : isListening 
            ? 'Đang nghe... Click để dừng' 
            : 'Nhập đơn bằng giọng nói'
        }
      >
        {isTranscribing ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span>Đang xử lý...</span>
          </>
        ) : isListening ? (
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

