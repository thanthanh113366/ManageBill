import { useState, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';

/**
 * Custom hook for Backend Whisper API
 * Records audio and sends to backend for transcription
 * Frontend handles parsing and matching using existing logic
 * 
 * API Endpoint: POST /transcribe
 * Backend URL: From VITE_BACKEND_API_URL or default from API_DOCUMENTATION.md
 */
export const useBackendWhisperRecognition = (onResult) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  // Backend URL from env or default from API_DOCUMENTATION.md
  const backendUrl = import.meta.env.VITE_BACKEND_API_URL || 'https://therapist-squad-requiring-steady.trycloudflare.com';

  /**
   * Start recording audio
   */
  const startListening = useCallback(async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      });
      
      streamRef.current = stream;
      audioChunksRef.current = [];

      // Create MediaRecorder - Use webm format as recommended in API_DOCUMENTATION.md
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/ogg';
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType
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
  }, []);

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
   * Transcribe audio using Backend API
   * Backend only returns transcript, frontend handles parsing/matching
   */
  const transcribeAudio = useCallback(async () => {
    if (audioChunksRef.current.length === 0) {
      console.warn('No audio chunks to transcribe');
      setIsProcessing(false);
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Combine audio chunks into blob
      const audioBlob = new Blob(audioChunksRef.current, { 
        type: mediaRecorderRef.current?.mimeType || 'audio/webm' 
      });

      // Create FormData as per API_DOCUMENTATION.md
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');

      console.log('Sending audio to backend:', `${backendUrl}/transcribe`);

      // Call Backend API
      const response = await fetch(`${backendUrl}/transcribe`, {
        method: 'POST',
        body: formData
      });

      // Handle errors as per API_DOCUMENTATION.md
      if (response.status === 503) {
        throw new Error('Whisper service is currently unavailable');
      }

      if (response.status === 500) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Transcription failed');
      }

      if (response.status === 400) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Missing or invalid file');
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const transcribedText = data.text?.trim();

      if (!transcribedText || transcribedText === '') {
        throw new Error('Empty transcript received');
      }

      console.log('Received transcript from backend:', transcribedText);
      setTranscript(transcribedText);
      
      if (onResult) {
        onResult(transcribedText);
      }

    } catch (err) {
      console.error('Error transcribing audio:', err);
      setError(err.message);
      
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        toast.error(`Không thể kết nối đến backend. Vui lòng kiểm tra kết nối.`);
      } else if (err.message.includes('503')) {
        toast.error('Dịch vụ Whisper hiện không khả dụng. Vui lòng thử lại sau.');
      } else {
        toast.error(`Lỗi transcribe: ${err.message}`);
      }
    } finally {
      setIsProcessing(false);
      audioChunksRef.current = [];
    }
  }, [backendUrl, onResult]);

  return {
    isListening,
    isProcessing,
    transcript,
    error,
    isConfigured: true, // Backend URL is always configured
    startListening,
    stopListening
  };
};

