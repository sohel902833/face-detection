import io
import time
import logging
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import cv2
from PIL import Image
import os

from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MATCH_THRESHOLD = float(os.getenv("MATCH_THRESHOLD", "0.40"))
MODEL_DIR = os.getenv("MODEL_DIR", "./models")

app = FastAPI(title="Face Recognition Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global face analyzer - loaded once at startup
face_app = None

def get_face_app():
    global face_app
    if face_app is None:
        try:
            import insightface
            from insightface.app import FaceAnalysis
            
            models_dir = MODEL_DIR
            os.makedirs(models_dir, exist_ok=True)
            
            face_app = FaceAnalysis(
                name="buffalo_sc",  # Lightweight model: ~85MB, fast inference
                root=models_dir,
                providers=['CPUExecutionProvider']
            )
            face_app.prepare(ctx_id=-1, det_size=(320, 320))  # Smaller det_size = faster
            logger.info("InsightFace model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load InsightFace: {e}")
            raise
    return face_app


class EmbeddingResponse(BaseModel):
    success: bool
    embedding: Optional[list] = None
    message: str
    face_count: int = 0
    processing_time_ms: float = 0


class MatchResponse(BaseModel):
    success: bool
    match: bool
    similarity: float
    message: str
    processing_time_ms: float = 0


def read_image_from_bytes(file_bytes: bytes) -> np.ndarray:
    """Convert uploaded file bytes to OpenCV image."""
    nparr = np.frombuffer(file_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image")
    return img


def get_face_embedding(img: np.ndarray) -> tuple[Optional[np.ndarray], int]:
    """Extract face embedding from image. Returns (embedding, face_count)."""
    fa = get_face_app()
    
    # Convert BGR to RGB for InsightFace
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    
    faces = fa.get(img_rgb)
    
    if len(faces) == 0:
        return None, 0
    
    if len(faces) > 1:
        # Use the largest/most prominent face
        faces = sorted(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]), reverse=True)
    
    embedding = faces[0].normed_embedding  # Already L2 normalized
    return embedding, len(faces)


def cosine_similarity(emb1: np.ndarray, emb2: np.ndarray) -> float:
    """Compute cosine similarity between two normalized embeddings."""
    # Since embeddings are already L2 normalized, dot product = cosine similarity
    similarity = float(np.dot(emb1, emb2))
    return similarity


@app.on_event("startup")
async def startup_event():
    """Pre-load model at startup."""
    logger.info("Loading face recognition model...")
    try:
        get_face_app()
        logger.info("Model ready!")
    except Exception as e:
        logger.error(f"Failed to load model on startup: {e}")


@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": face_app is not None}


@app.post("/detect-and-embed", response_model=EmbeddingResponse)
async def detect_and_embed(file: UploadFile = File(...)):
    """
    Detect face in image and return its embedding.
    Used during registration.
    """
    start = time.time()
    
    try:
        contents = await file.read()
        img = read_image_from_bytes(contents)
        
        embedding, face_count = get_face_embedding(img)
        
        elapsed_ms = (time.time() - start) * 1000
        
        if embedding is None:
            return EmbeddingResponse(
                success=False,
                message="No face detected in the image. Please provide a clear frontal photo.",
                face_count=0,
                processing_time_ms=elapsed_ms
            )
        
        return EmbeddingResponse(
            success=True,
            embedding=embedding.tolist(),
            message=f"Face detected successfully. Found {face_count} face(s), using primary.",
            face_count=face_count,
            processing_time_ms=elapsed_ms
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in detect_and_embed: {e}")
        raise HTTPException(status_code=500, detail="Face detection failed")


@app.post("/match-face", response_model=MatchResponse)
async def match_face(
    file: UploadFile = File(...),
    stored_embedding: str = Form(...)
):
    """
    Compare live face image against stored embedding.
    Used during login and attendance.
    Threshold: 0.45 cosine similarity (tuned for buffalo_sc model)
    """
    start = time.time()
    
    try:
        # Parse stored embedding
        import json
        stored_emb_list = json.loads(stored_embedding)
        stored_emb = np.array(stored_emb_list, dtype=np.float32)
        
        # Re-normalize stored embedding just in case
        norm = np.linalg.norm(stored_emb)
        if norm > 0:
            stored_emb = stored_emb / norm
        
        # Process live image
        contents = await file.read()
        img = read_image_from_bytes(contents)
        
        live_emb, face_count = get_face_embedding(img)
        
        elapsed_ms = (time.time() - start) * 1000
        
        if live_emb is None:
            return MatchResponse(
                success=False,
                match=False,
                similarity=0.0,
                message="No face detected in the provided image.",
                processing_time_ms=elapsed_ms
            )
        
        similarity = cosine_similarity(stored_emb, live_emb)
        
        # Threshold from env (default 0.40)
        is_match = similarity >= MATCH_THRESHOLD
        
        logger.info(f"Face match: similarity={similarity:.4f}, match={is_match}, time={elapsed_ms:.1f}ms")
        
        return MatchResponse(
            success=True,
            match=is_match,
            similarity=round(similarity, 4),
            message="Face matched successfully" if is_match else "Face does not match registered user",
            processing_time_ms=elapsed_ms
        )
        
    except Exception as e:
        logger.error(f"Error in match_face: {e}")
        raise HTTPException(status_code=500, detail=f"Face matching failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
