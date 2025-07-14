from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, WebSocket, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, PlainTextResponse, HTMLResponse
from fastapi.websockets import WebSocketDisconnect
from typing import Optional, List
import uvicorn
import os
import json
import base64
import asyncio
import subprocess
import time
import re
import websockets
from datetime import datetime
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse, Connect
from pydantic import BaseModel

from models import (Job, JobCreate, Candidate, CandidateCreate, JobMatch,
                    JobMatchCreate, JobMatchResult, AIMatchRequest,
                    StatsResponse)
from storage import storage
from ai_processing import (extract_resume_data_from_image,
                           batch_match_candidates)

# AI Calling configuration
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
PHONE_NUMBER_FROM = os.getenv("PHONE_NUMBER_FROM")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

SYSTEM_MESSAGE = (
    "You are Sarah, a friendly and professional AI recruitment assistant from Aigiri.ai. "
    "Your job is to schedule a job interview meeting with candidates based on their available date and time. "
    "Start the conversation by greeting the candidate, introducing yourself as an AI agent from Aigiri.ai. "
    "Keep the conversation natural and engaging. Show genuine interest in their responses. "
    "Always stay positive and professional. "
    "If the user asks questions unrelated to the interview follow-up, "
    "politely redirect them back to discussing their interview experience. "
    "IMPORTANT: When confirming any interview date and time, ALWAYS use this exact format: "
    "'Let me confirm the interview on MM-DD-YYYY at HH:MM AM/PM' (e.g., 'Let me confirm the interview on 06-29-2025 at 04:30 PM'). "
    "Always convert any date format provided by the candidate to MM-DD-YYYY format and time to HH:MM AM/PM format in your confirmation. "
    "If candidate is busy, politely ask them to provide an alternative date and time to call them back. "
    "HANDLING UNCLEAR RESPONSES: If the candidate's response is unclear, incomplete, or in a non-English language, "
    "politely repeat your question more clearly. Say something like 'I'am sorry, I didnt understand. "
    "Could you please tell me what date and time would work best for your interview?"
    "If they continue to give unclear responses, gently ask them to speak in English and provide a specific date and time. "
    "Stay patient and helpful throughout the conversation.")
VOICE = 'shimmer'

# Global variables
ngrok_domain = None
twilio_client = None
conversation_transcripts = {}
transcript_file_handles = {}

if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)


class CallRequest(BaseModel):
    phoneNumber: str
    candidateName: str


app = FastAPI(title="AIM Hi System API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Job endpoints
@app.post("/api/jobs", response_model=Job)
async def create_job(job: JobCreate):
    """Create a new job posting"""
    try:
        return storage.create_job(job)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/jobs", response_model=List[Job])
async def get_jobs():
    """Get all job postings"""
    return storage.get_all_jobs()


@app.get("/api/jobs/{job_id}", response_model=Job)
async def get_job(job_id: int):
    """Get a specific job posting"""
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


# Candidate endpoints
@app.post("/api/candidates", response_model=Candidate)
async def create_candidate(resume: UploadFile = File(...),
                           name: Optional[str] = Form(None),
                           email: Optional[str] = Form(None),
                           phone: Optional[str] = Form(None),
                           experience: Optional[int] = Form(None)):
    """Create a new candidate with resume upload"""
    try:
        # Check file type
        if not resume.content_type:
            raise HTTPException(status_code=400, detail="Invalid file type")

        # Read file content
        file_content = await resume.read()

        # Check if it's an image file
        is_image = resume.content_type.startswith('image/')

        if is_image:
            # Extract data from image using AI
            try:
                extracted_data = await extract_resume_data_from_image(
                    file_content)
                candidate_data = CandidateCreate(
                    name=extracted_data.name,
                    email=extracted_data.email,
                    phone=extracted_data.phone,
                    experience=extracted_data.experience,
                    resume_content=extracted_data.resume_content,
                    resume_file_name=resume.filename or "image_resume")
            except Exception as ai_error:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to process resume image: {str(ai_error)}")
        else:
            # Handle PDF files (require manual data)
            if not all([name, email, phone, experience is not None]):
                raise HTTPException(
                    status_code=400,
                    detail=
                    "For PDF files, please provide name, email, phone, and experience"
                )

            resume_content = f"Resume for {name}. Experience: {experience} years. Email: {email}. Phone: {phone}."
            candidate_data = CandidateCreate(name=name or "",
                                             email=email or "",
                                             phone=phone or "",
                                             experience=experience or 0,
                                             resume_content=resume_content,
                                             resume_file_name=resume.filename
                                             or "resume.pdf")

        # Check if candidate already exists
        existing_candidate = storage.get_candidate_by_email(
            candidate_data.email)
        if existing_candidate:
            raise HTTPException(
                status_code=400,
                detail="Candidate with this email already exists")

        return storage.create_candidate(candidate_data)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400,
                            detail=f"Failed to create candidate: {str(e)}")


@app.get("/api/candidates", response_model=List[Candidate])
async def get_candidates():
    """Get all candidates"""
    return storage.get_all_candidates()


@app.get("/api/matches", response_model=List[JobMatchResult])
async def get_matches(job_id: Optional[int] = None,
                      min_percentage: Optional[float] = 50):
    """Get job matches with optional filtering"""
    try:
        return storage.get_job_matches(job_id, min_percentage)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch matches")


# Resume download endpoint
@app.get("/api/candidates/{candidate_id}/resume")
async def download_resume(candidate_id: int):
    """Download a candidate's resume"""
    try:
        candidate = storage.get_candidate(candidate_id)
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")

        # Return resume content as downloadable text file
        return PlainTextResponse(
            content=candidate.resume_content,
            headers={
                "Content-Disposition":
                f'attachment; filename="{candidate.resume_file_name}"'
            })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500,
                            detail="Failed to download resume")


# Stats endpoint
@app.get("/api/stats", response_model=StatsResponse)
async def get_stats():
    """Get application statistics"""
    try:
        jobs = storage.get_all_jobs()
        candidates = storage.get_all_candidates()
        matches = storage.get_job_matches()

        # Calculate today's matches
        today = datetime.now().date()
        today_matches = [m for m in matches if m.created_at.date() == today]

        # Calculate average match rate
        avg_match_rate = 0
        if matches:
            avg_match_rate = round(
                sum(m.match_percentage for m in matches) / len(matches))

        return StatsResponse(active_jobs=len(jobs),
                             total_candidates=len(candidates),
                             ai_matches=len(today_matches),
                             avg_match_rate=avg_match_rate)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to fetch stats")


# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "AIM Hi System API is running"}


# AI Calling functionality
def get_current_ngrok_domain():
    """Get the current active ngrok domain from the API."""
    try:
        # Get tunnel info from ngrok API
        result = subprocess.run(
            ["curl", "-s", "http://localhost:4040/api/tunnels"],
            capture_output=True,
            text=True)

        if result.returncode == 0:
            tunnels = json.loads(result.stdout)
            for tunnel in tunnels.get("tunnels", []):
                if tunnel["proto"] == "https":
                    url = tunnel["public_url"]
                    current_domain = re.sub(r'https?://', '', url)
                    print(f"Current ngrok domain: {current_domain}")
                    return current_domain
    except Exception as e:
        print(f"Error fetching ngrok domain: {e}")

    return None


# AI calling handler disabled - using TypeScript handler in routes.ts instead
# @app.post("/api/initiate-ai-call")
# async def initiate_ai_call(request: CallRequest):


@app.api_route("/incoming_call", methods=["GET", "POST"])
async def incoming_call(request: Request):
    """Handle incoming call and return TwiML response to connect to Media Stream."""
    response = VoiceResponse()

    if ngrok_domain:
        connect = Connect()
        connect.stream(url=f'wss://{ngrok_domain}/media-stream')
        response.append(connect)
    else:
        response.say("Sorry, the AI service is not available right now.")

    return HTMLResponse(content=str(response), media_type="application/xml")


@app.websocket('/media-stream')
async def handle_media_stream(websocket: WebSocket):
    """Handle WebSocket connections between Twilio and OpenAI."""
    print("Client connected to media stream")
    await websocket.accept()

    if not OPENAI_API_KEY:
        print("OpenAI API key not configured")
        await websocket.close()
        return

    stream_sid = None  # Initialize to avoid NameError in finally block

    try:
        async with websockets.connect(
                'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01',
                additional_headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "OpenAI-Beta": "realtime=v1"
                }) as openai_ws:
            print("Connected to OpenAI Realtime API")
            await initialize_session(openai_ws)
            stream_sid = None
            call_sid = None

            async def receive_from_twilio():
                """Receive audio data from Twilio and send it to the OpenAI Realtime API."""
                nonlocal stream_sid, call_sid
                try:
                    async for message in websocket.iter_text():
                        data = json.loads(message)
                        if data['event'] == 'media':
                            audio_append = {
                                "type": "input_audio_buffer.append",
                                "audio": data['media']['payload']
                            }
                            await openai_ws.send(json.dumps(audio_append))
                        elif data['event'] == 'start':
                            stream_sid = data['start']['streamSid']
                            call_sid = data['start']['callSid']
                            print(f"Incoming stream started: {stream_sid}")
                            # Initialize conversation transcript and open file handle
                            start_time = datetime.now()
                            conversation_transcripts[stream_sid] = {
                                'call_sid': call_sid,
                                'start_time': start_time,
                                'messages': []
                            }
                            await open_transcript_file(stream_sid, call_sid,
                                                       start_time)
                except WebSocketDisconnect:
                    print("Twilio client disconnected")
                    # Close transcript file when Twilio disconnects
                    if stream_sid:
                        await close_transcript_file(stream_sid)
                except Exception as e:
                    print(f"Error in receive_from_twilio: {e}")
                    # Close transcript file on error
                    if stream_sid:
                        await close_transcript_file(stream_sid)

            async def send_to_twilio():
                """Receive events from the OpenAI Realtime API, send audio back to Twilio."""
                nonlocal stream_sid
                try:
                    async for openai_message in openai_ws:
                        response = json.loads(openai_message)

                        # Debug: Print all received events to understand the structure
                        print(
                            f"OpenAI Event: {response.get('type', 'unknown')}")
                        if response.get('type') not in [
                                'response.audio.delta',
                                'input_audio_buffer.append'
                        ]:
                            print(f"Full event data: {response}")

                        if response['type'] == 'session.updated':
                            print("Session updated successfully")
                        elif response[
                                'type'] == 'response.audio.delta' and response.get(
                                    'delta'):
                            if stream_sid:
                                try:
                                    audio_payload = base64.b64encode(
                                        base64.b64decode(
                                            response['delta'])).decode('utf-8')
                                    audio_delta = {
                                        "event": "media",
                                        "streamSid": stream_sid,
                                        "media": {
                                            "payload": audio_payload
                                        }
                                    }
                                    await websocket.send_json(audio_delta)
                                except Exception as e:
                                    print(f"Error processing audio data: {e}")
                        elif response[
                                'type'] == 'conversation.item.input_audio_transcription.completed':
                            # Capture user speech transcription
                            if stream_sid and stream_sid in conversation_transcripts:
                                transcript = response.get('transcript', '')
                                if transcript.strip():
                                    conversation_transcripts[stream_sid][
                                        'messages'].append({
                                            'timestamp':
                                            datetime.now(),
                                            'speaker':
                                            'User',
                                            'text':
                                            transcript
                                        })
                                    print(f"User said: {transcript}")
                                    # Write to file immediately
                                    await write_to_transcript_file(
                                        stream_sid, 'User', transcript)
                        elif response[
                                'type'] == 'response.audio_transcript.delta':
                            # Capture AI response text chunks
                            if stream_sid and stream_sid in conversation_transcripts:
                                delta_text = response.get('delta', '')
                                if delta_text:
                                    # Find or create current AI message
                                    messages = conversation_transcripts[
                                        stream_sid]['messages']
                                    if messages and messages[-1][
                                            'speaker'] == 'AI Assistant (Sarah)':
                                        # Append to existing message (accumulate text)
                                        messages[-1]['text'] += delta_text
                                    else:
                                        # Create new AI message
                                        messages.append({
                                            'timestamp':
                                            datetime.now(),
                                            'speaker':
                                            'AI Assistant (Sarah)',
                                            'text':
                                            delta_text
                                        })
                                    # Don't write to file yet - wait for complete response
                        elif response[
                                'type'] == 'response.audio_transcript.done':
                            # AI response transcript complete - write full message to file
                            if stream_sid and stream_sid in conversation_transcripts:
                                messages = conversation_transcripts[
                                    stream_sid]['messages']
                                if messages and messages[-1][
                                        'speaker'] == 'AI Assistant (Sarah)':
                                    complete_text = messages[-1]['text']
                                    if complete_text.strip():
                                        await write_to_transcript_file(
                                            stream_sid, 'AI Assistant (Sarah)',
                                            complete_text)
                                        print(
                                            f"AI Assistant (Sarah) said: {complete_text}"
                                        )
                        elif response['type'] == 'response.done':
                            # Response complete - continue conversation
                            print(
                                "Response completed, continuing conversation..."
                            )
                        elif response['type'] in [
                                'input_audio_buffer.speech_started',
                                'input_audio_buffer.speech_stopped'
                        ]:
                            print(f"Event: {response['type']}")

                except Exception as e:
                    print(f"Error in send_to_twilio: {e}")

            await asyncio.gather(receive_from_twilio(), send_to_twilio())
    except Exception as e:
        print(f"Error in media stream handler: {e}")
        await websocket.close()
    finally:
        # Close transcript file when call ends
        print(f"Call ended. stream_sid: {stream_sid}")
        if stream_sid:
            await close_transcript_file(stream_sid)


async def open_transcript_file(stream_sid, call_sid, start_time):
    """Open a file handle for writing transcript in real-time."""
    try:
        # Create call-transcripts directory if it doesn't exist
        import os
        os.makedirs('call-transcripts', exist_ok=True)

        # Generate filename with timestamp
        timestamp = start_time.strftime('%Y%m%d_%H%M%S')
        filename = f'call-transcripts/call_{call_sid}_{timestamp}.txt'

        # Open file handle for writing
        file_handle = open(filename, 'w', encoding='utf-8')
        transcript_file_handles[stream_sid] = {
            'handle': file_handle,
            'filename': filename
        }

        # Write header information
        header = f"AI Interview Call Transcript\n"
        header += f"Call SID: {call_sid}\n"
        header += f"Stream SID: {stream_sid}\n"
        header += f"Date: {start_time.strftime('%Y-%m-%d %H:%M:%S')}\n"
        header += f"{'='*50}\n\n"

        file_handle.write(header)
        file_handle.flush()  # Ensure header is written immediately

        print(f"Transcript file opened: {filename}")

    except Exception as e:
        print(f"Error opening transcript file: {e}")


async def write_to_transcript_file(stream_sid, speaker, text):
    """Write a complete message to the transcript file."""
    try:
        if stream_sid in transcript_file_handles:
            file_handle = transcript_file_handles[stream_sid]['handle']
            timestamp = datetime.now().strftime('%H:%M:%S')
            message = f"[{timestamp}] {speaker}: {text}\n\n"
            file_handle.write(message)
            file_handle.flush()  # Ensure immediate write to disk

    except Exception as e:
        print(f"Error writing to transcript file: {e}")


async def append_to_transcript_file(stream_sid, text):
    """Append text to the current message in the transcript file."""
    try:
        if stream_sid in transcript_file_handles:
            file_handle = transcript_file_handles[stream_sid]['handle']
            file_handle.write(text)
            file_handle.flush()  # Ensure immediate write to disk

    except Exception as e:
        print(f"Error appending to transcript file: {e}")


async def close_transcript_file(stream_sid):
    """Close the transcript file handle and clean up."""
    try:
        if stream_sid in transcript_file_handles:
            file_data = transcript_file_handles[stream_sid]
            file_handle = file_data['handle']
            filename = file_data['filename']

            # Write footer with final timestamp
            footer = f"\n{'='*50}\n"
            footer += f"Call ended: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
            file_handle.write(footer)

            # Close file handle
            file_handle.close()

            # Clean up from memory
            del transcript_file_handles[stream_sid]
            if stream_sid in conversation_transcripts:
                del conversation_transcripts[stream_sid]

            print(f"Transcript file closed: {filename}")

    except Exception as e:
        print(f"Error closing transcript file: {e}")


async def send_initial_conversation_item(openai_ws):
    """Send initial conversation so AI talks first."""
    # Instead of creating a fake user message, just trigger a response
    # The AI will start with its introduction based on the system message
    response_create = {
        "type": "response.create",
        "response": {
            "modalities": ["text", "audio"],
            "instructions":
            "Start the conversation by introducing yourself exactly as: 'Hi, My name is Sarah. I am an AI Recruitment agent from Aigiri.ai. Your resume has been shortlisted for an excellent job opportunity. Is this a good time to talk?"
        }
    }
    await openai_ws.send(json.dumps(response_create))


async def initialize_session(openai_ws):
    """Initialize session with OpenAI."""
    session_update = {
        "type": "session.update",
        "session": {
            "turn_detection": {
                "type": "server_vad"
            },
            "input_audio_format": "g711_ulaw",
            "output_audio_format": "g711_ulaw",
            "input_audio_transcription": {
                "model": "whisper-1"
            },
            "voice": VOICE,
            "instructions": SYSTEM_MESSAGE,
            "modalities": ["text", "audio"],
            "temperature": 0.8,
        }
    }
    print('Sending session update to OpenAI')
    await openai_ws.send(json.dumps(session_update))

    # Have the AI speak first
    await send_initial_conversation_item(openai_ws)


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))  # Use different port to avoid conflict
    print(f"🐍 Python FastAPI server starting on port {port}")
    print(f"📊 AIM Hi System Python Backend - Ready for AI processing!")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
