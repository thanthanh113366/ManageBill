# API Documentation for Frontend

## API Endpoint

### POST `/transcribe`

Transcribe audio file to Vietnamese text.

**URL:**
```
https://therapist-squad-requiring-steady.trycloudflare.com/transcribe
```

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: FormData với field `file` (audio file)

**Response:**
```json
{
  "text": "Một phần ốc hương, một phần sò điệp"
}
```

**Status Codes:**
- `200 OK`: Success
- `400 Bad Request`: Missing or invalid file
- `500 Internal Server Error`: Transcription error
- `503 Service Unavailable`: Whisper service disabled

---

## Frontend Implementation

### Step 1: Record Audio

```javascript
async function recordAudio() {
  const stream = await navigator.mediaDevices.getUserMedia({ 
    audio: {
      echoCancellation: true,
      noiseSuppression: true
    } 
  });
  
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'audio/webm;codecs=opus'
  });
  
  const chunks = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  
  return new Promise((resolve, reject) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      stream.getTracks().forEach(track => track.stop());
      resolve(blob);
    };
    
    mediaRecorder.onerror = reject;
    mediaRecorder.start();
    
    // Auto stop after 10 seconds
    setTimeout(() => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    }, 10000);
  });
}
```

### Step 2: Call API

```javascript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://therapist-squad-requiring-steady.trycloudflare.com';

async function transcribeAudio(audioBlob) {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  
  const response = await fetch(`${API_URL}/transcribe`, {
    method: 'POST',
    body: formData
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  
  const { text } = await response.json();
  return text;
}
```

### Step 3: Complete Flow

```javascript
async function handleVoiceOrder() {
  try {
    // 1. Record
    const audioBlob = await recordAudio();
    
    // 2. Transcribe
    const transcript = await transcribeAudio(audioBlob);
    // transcript: "Một phần ốc hương, một phần sò điệp"
    
    // 3. Parse và match với Firebase (frontend tự làm)
    // ... your parsing and matching logic here
    
    return transcript;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}
```

---

## React Component Example

```javascript
import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://therapist-squad-requiring-steady.trycloudflare.com';

function VoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const recordAudio = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    });
    
    const chunks = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    
    return new Promise((resolve) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        resolve(blob);
      };
      mediaRecorder.start();
      setTimeout(() => mediaRecorder.stop(), 10000);
    });
  };

  const transcribeAudio = async (audioBlob) => {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    
    const response = await fetch(`${API_URL}/transcribe`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    
    const { text } = await response.json();
    return text;
  };

  const handleRecord = async () => {
    try {
      setIsRecording(true);
      setError(null);
      setLoading(false);
      
      const audioBlob = await recordAudio();
      
      setLoading(true);
      const text = await transcribeAudio(audioBlob);
      setTranscript(text);
      
      // Parse và match với Firebase ở đây
      // ...
      
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRecording(false);
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleRecord} disabled={isRecording || loading}>
        {isRecording ? 'Recording...' : loading ? 'Transcribing...' : 'Start Recording'}
      </button>
      
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {transcript && <p>Transcript: {transcript}</p>}
    </div>
  );
}
```

---

## Environment Variables

**Development (.env.local):**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Production (Vercel):**
```env
NEXT_PUBLIC_API_URL=https://therapist-squad-requiring-steady.trycloudflare.com
```

**Lưu ý:** URL Cloudflare Tunnel sẽ thay đổi mỗi lần restart. Để có URL cố định, deploy backend lên Railway/Render.

---

## Error Handling

```javascript
async function transcribeAudio(audioBlob) {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  
  try {
    const response = await fetch(`${API_URL}/transcribe`, {
      method: 'POST',
      body: formData
    });
    
    if (response.status === 503) {
      throw new Error('Whisper service is currently unavailable');
    }
    
    if (response.status === 500) {
      const error = await response.json();
      throw new Error(error.detail || 'Transcription failed');
    }
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const { text } = await response.json();
    
    if (!text || text.trim() === '') {
      throw new Error('Empty transcript received');
    }
    
    return text;
    
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Cannot connect to backend. Check your connection.');
    }
    throw error;
  }
}
```

---

## Testing

### Swagger UI (Recommended)

Mở browser và vào:
```
https://therapist-squad-requiring-steady.trycloudflare.com/docs
```

1. Tìm `POST /transcribe`
2. Click **"Try it out"**
3. Chọn audio file
4. Click **"Execute"**
5. Xem response

### cURL

```bash
curl -X POST https://therapist-squad-requiring-steady.trycloudflare.com/transcribe \
  -F "file=@recording.webm"
```

---

## Supported Formats

- **webm** (recommended)
- **mp3**
- **wav**
- **m4a**
- **ogg**

**Recommended:** Use `audio/webm` với MediaRecorder API.

---

## Notes

- **Language:** Vietnamese (vi) - automatically detected
- **Response time:** 2-5 seconds for 5-10 second audio
- **File size:** Recommended < 10MB
- **CORS:** Already configured for Vercel domains

---

## Next Steps (Frontend)

Sau khi nhận transcript:

1. **Parse transcript** → Extract quantity + dish name
2. **Fetch menu items** từ Firebase
3. **Match** parsed items với menu items
4. **Display** results
