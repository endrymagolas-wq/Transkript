import os
import yt_dlp
import assemblyai as aai
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uuid
import json
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration - User should set their API key here
# For now, we use a placeholder. In a real app, this should be in .env
AAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY", "")
if AAI_API_KEY:
    aai.settings.api_key = AAI_API_KEY

class TranscribeRequest(BaseModel):
    url: str
    api_key: Optional[str] = None

class Utterance(BaseModel):
    speaker: str
    text: str
    start: float
    end: float

class TranscriptionResponse(BaseModel):
    id: str
    status: str
    text: Optional[str] = None
    utterances: Optional[List[Utterance]] = None

@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_instagram(request: TranscribeRequest):
    if request.api_key:
        aai.settings.api_key = request.api_key
    
    if not aai.settings.api_key:
        raise HTTPException(status_code=400, detail="AssemblyAI API key is required. Get one at https://www.assemblyai.com/")

    # 1. Use yt-dlp to download the audio locally
    import tempfile
    import glob
    
    temp_dir = tempfile.mkdtemp()
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'quiet': True,
        'no_warnings': True,
        'outtmpl': os.path.join(temp_dir, '%(id)s.%(ext)s'),
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([request.url])
            
        # Find the downloaded file
        downloaded_files = os.listdir(temp_dir)
        if not downloaded_files:
            raise Exception("No file was downloaded")
        file_path = os.path.join(temp_dir, downloaded_files[0])
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to extract audio from URL: {str(e)}")

    # 2. Start transcription with AssemblyAI
    try:
        config = aai.TranscriptionConfig(
            speaker_labels=True,
            language_detection=True
        )
        transcriber = aai.Transcriber()
        transcript = transcriber.transcribe(file_path, config=config)
        
        # Cleanup
        try:
            os.remove(file_path)
            os.rmdir(temp_dir)
        except:
            pass
        
        if transcript.status == aai.TranscriptStatus.error:
            raise HTTPException(status_code=500, detail=f"Transcription failed: {transcript.error}")

        utterances = []
        if transcript.utterances:
            for utt in transcript.utterances:
                utterances.append(Utterance(
                    speaker=f"Speaker {utt.speaker}",
                    text=utt.text,
                    start=utt.start / 1000.0, # convert ms to s
                    end=utt.end / 1000.0
                ))
        
        return TranscriptionResponse(
            id=transcript.id,
            status="completed",
            text=transcript.text,
            utterances=utterances
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
