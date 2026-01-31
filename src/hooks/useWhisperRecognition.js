import { useState, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';

/**
 * Custom hook for Whisper API (OpenAI Cloud)
 * Records audio and transcribes using OpenAI Whisper API
 * 
 * Features:
 * - Record audio from microphone
 * - Send to Whisper API for transcription
 * - Better accuracy than Web Speech API for Vietnamese
 * - Works in all browsers (not just Chrome/Edge)
 * 
 * Requirements:
 * - VITE_OPENAI_API_KEY in .env
 * - openai package installed
 */
export const useWhisperRecognition = (onResult) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  // Check if OpenAI API key is configured
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  const isConfigured = !!apiKey;

  /**
   * Start recording audio
   */
  const startListening = useCallback(async () => {
    if (!isConfigured) {
      toast.error('Whisper API chưa được cấu hình. Vui lòng thêm VITE_OPENAI_API_KEY vào .env');
      setError('API key not configured');
      return;
    }

    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000 // Whisper works best with 16kHz
        } 
      });
      
      streamRef.current = stream;
      audioChunksRef.current = [];

      // Create MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/ogg';
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000
      });
      
      mediaRecorderRef.current = mediaRecorder;

      // Collect audio chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // When recording stops, transcribe
      mediaRecorder.onstop = () => {
        // transcribeAudio will be called automatically
        // Don't await here to avoid blocking
        transcribeAudio();
      };

      // Start recording
      mediaRecorder.start(1000); // Collect data every 1 second
      setIsListening(true);
      setError(null);
      
    } catch (err) {
      console.error('Error starting recording:', err);
      setError(err.message);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        toast.error('Vui lòng cho phép sử dụng microphone.');
      } else if (err.name === 'NotFoundError') {
        toast.error('Không tìm thấy microphone.');
      } else {
        toast.error(`Lỗi: ${err.message}`);
      }
    }
  }, [isConfigured, onResult]);

  /**
   * Stop recording and transcribe
   */
  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      
      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      setIsListening(false);
    }
  }, [isListening]);

  /**
   * Transcribe audio using Whisper API
   */
  const transcribeAudio = useCallback(async () => {
    if (audioChunksRef.current.length === 0) {
      console.warn('No audio chunks to transcribe');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Combine audio chunks into blob
      const audioBlob = new Blob(audioChunksRef.current, { 
        type: mediaRecorderRef.current?.mimeType || 'audio/webm' 
      });

      // Create FormData
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', 'vi'); // Vietnamese

      // Call Whisper API
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API Error: ${response.status}`);
      }

      const data = await response.json();
      const transcribedText = data.text?.trim();

      if (transcribedText) {
        setTranscript(transcribedText);
        if (onResult) {
          onResult(transcribedText);
        }
      } else {
        toast.warning('Không nhận diện được giọng nói. Vui lòng thử lại.');
      }

    } catch (err) {
      console.error('Error transcribing audio:', err);
      setError(err.message);
      
      if (err.message.includes('API key')) {
        toast.error('Lỗi API key. Vui lòng kiểm tra VITE_OPENAI_API_KEY.');
      } else if (err.message.includes('quota') || err.message.includes('billing')) {
        toast.error('Đã hết quota hoặc chưa setup billing. Vui lòng kiểm tra tài khoản OpenAI.');
      } else {
        toast.error(`Lỗi transcribe: ${err.message}`);
      }
    } finally {
      setIsProcessing(false);
      audioChunksRef.current = [];
    }
  }, [apiKey, onResult]);

  return {
    isListening,
    isProcessing,
    transcript,
    error,
    isConfigured,
    startListening,
    stopListening
  };
};

