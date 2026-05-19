import os
import shutil
import tempfile
import yt_dlp
import assemblyai as aai
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
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
    source_platform: Optional[str] = None
    source_title: Optional[str] = None


def build_ydl_options(temp_dir: Optional[str] = None):
    cookie_file = os.getenv("YTDLP_COOKIE_FILE")
    ydl_opts = {
        "format": "bestaudio/best",
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
    }

    if temp_dir:
        ydl_opts["outtmpl"] = os.path.join(temp_dir, "%(id)s.%(ext)s")

    if cookie_file:
        ydl_opts["cookiefile"] = cookie_file

    return ydl_opts


def extract_platform_name(info: dict) -> Optional[str]:
    extractor = info.get("extractor_key") or info.get("extractor")
    if not extractor:
        return None

    normalized = extractor.replace("_", " ").replace("-", " ").strip()
    known_platforms = {
        "Instagram": "Instagram",
        "TikTok": "TikTok",
        "Youtube": "YouTube",
        "Twitter": "X/Twitter",
        "Facebook": "Facebook",
        "Vimeo": "Vimeo",
        "Reddit": "Reddit",
    }

    return known_platforms.get(normalized.title(), normalized.title())

@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_social_video(request: TranscribeRequest):
    if request.api_key:
        aai.settings.api_key = request.api_key
    
    if not aai.settings.api_key:
        raise HTTPException(status_code=400, detail="AssemblyAI API key is required. Get one at https://www.assemblyai.com/")

    temp_dir = tempfile.mkdtemp()
    source_title = None
    source_platform = None
    file_path = None
    
    try:
        with yt_dlp.YoutubeDL(build_ydl_options(temp_dir)) as ydl:
            info = ydl.extract_info(request.url, download=True)

        downloaded_files = os.listdir(temp_dir)
        if not downloaded_files:
            raise Exception("No file was downloaded")

        file_path = os.path.join(temp_dir, downloaded_files[0])
        source_title = info.get("title")
        source_platform = extract_platform_name(info)
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=f"Failed to extract audio from URL: {str(e)}")

    try:
        config = aai.TranscriptionConfig(
            speech_models=["universal"],
            speaker_labels=True,
            language_detection=True
        )
        transcriber = aai.Transcriber()
        transcript = transcriber.transcribe(file_path, config=config)
        
        shutil.rmtree(temp_dir, ignore_errors=True)
        
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
            utterances=utterances,
            source_platform=source_platform,
            source_title=source_title,
        )
    except HTTPException:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Transcription error: {str(e)}")

@app.get("/audio_url")
async def get_audio_url(url: str):
    try:
        with yt_dlp.YoutubeDL(build_ydl_options()) as ydl:
            info = ydl.extract_info(url, download=False)
            return {"url": info.get('url', '')}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to get audio URL: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
