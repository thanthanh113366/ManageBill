import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook for Web Speech API
 * Handles speech recognition with browser compatibility and permission management
 * 
 * Features:
 * - Browser support detection (Chrome/Edge only)
 * - Microphone permission handling
 * - Real-time transcript display
 * - Error handling
 */
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
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' }).then((result) => {
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
    } else {
      // If permissions API not available, assume unknown
      setHasPermission(null);
    }

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

