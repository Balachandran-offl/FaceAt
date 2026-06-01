from fastapi import APIRouter, File, UploadFile
from pymongo import MongoClient
from insightface.app import FaceAnalysis

import faiss
import numpy as np
import cv2
import os
import sys
print("VISION.PY LOADED")
router = APIRouter()

# =========================
# MONGO SETUP
# =========================
client = MongoClient("mongodb+srv://Balachandran:DyNPSTJy8HWwRxHm@attendencecluster.uicwhnh.mongodb.net/?appName=Attendencecluster")
db = client["test"]
embedding_collection = db["studentEmbeddings"]
print("MongoDB setup complete")
# =========================
# FAISS SETUP
# =========================
EMBEDDING_DIM = 512
faiss_index = faiss.IndexFlatIP(EMBEDDING_DIM)  # cosine similarity via dot product
student_roll_map = []

# =========================
# FACE MODEL (InsightFace)
# =========================
INSIGHTFACE_MODEL_NAME = os.getenv("INSIGHTFACE_MODEL", "buffalo_l")
INSIGHTFACE_DET_SIZE = int(os.getenv("INSIGHTFACE_DET_SIZE", "320"))
face_detection_model = None
face_recognition_model = None


def prepare_face_model(allowed_modules):
    model = FaceAnalysis(
        name=INSIGHTFACE_MODEL_NAME,
        providers=["CPUExecutionProvider"],
        allowed_modules=allowed_modules
    )
    model.prepare(
        ctx_id=-1,
        det_size=(INSIGHTFACE_DET_SIZE, INSIGHTFACE_DET_SIZE)
    )
    return model


def get_detection_model():
    global face_detection_model

    if face_detection_model is None:
        face_detection_model = prepare_face_model(["detection"])

    return face_detection_model


def get_recognition_model():
    global face_recognition_model

    if face_recognition_model is None:
        face_recognition_model = prepare_face_model(["detection", "recognition"])

    return face_recognition_model



# =========================
# NORMALIZE VECTOR
# =========================
def normalize(vec):
    norm = np.linalg.norm(vec)
    if norm == 0:
        return vec
    return vec / norm


def build_quality_response(score, confidence, faces_detected, message, **extra):
    return {
        "score": round(float(score), 2),
        "confidence": round(float(confidence), 2),
        "faces_detected": int(faces_detected),
        "faces": int(faces_detected),
        "message": message,
        **extra
    }


# =========================
# BUILD FAISS INDEX
# =========================
def build_faiss_index():
    global faiss_index, student_roll_map

    faiss_index = faiss.IndexFlatIP(EMBEDDING_DIM)
    students = list(embedding_collection.find({}))

    vectors = []
    student_roll_map = []

    for student in students:
        roll_number = (
            student.get("rollNumber")
            or student.get("rollNo")
        )
        embedding_values = student.get("embedding")

        if not roll_number or not embedding_values:
            continue

        emb = np.array(embedding_values, dtype=np.float32)
        if emb.shape[0] != EMBEDDING_DIM:
            continue
        emb = normalize(emb)

        vectors.append(emb)
        student_roll_map.append(roll_number)

    if len(vectors) == 0:
        return

    vectors = np.array(vectors, dtype=np.float32)
    faiss_index.add(vectors)


# =========================
# ATTENDANCE API
# =========================
@router.post("/process-attendance")
async def process_attendance(file: UploadFile = File(...)):
    try:
        model = get_recognition_model()
        build_faiss_index()

        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return {"success": False, "message": "Invalid image"}

        faces = model.get(img)

        if len(faces) == 0:
            return {"success": False, "message": "No faces detected"}

        if faiss_index.ntotal == 0 or len(student_roll_map) == 0:
            return {
                "success": True,
                "presentStudents": [],
                "absentStudents": [],
                "message": "No approved student embeddings available"
            }

        present_students = set()

        for face in faces:

            embedding = face.embedding.astype(np.float32)
            embedding = normalize(embedding)

            query = np.array([embedding], dtype=np.float32)

            # FAISS SEARCH (TOP 1 MATCH)
            D, I = faiss_index.search(query, k=1)

            best_score = D[0][0]
            best_index = I[0][0]

            # threshold (tune this: 0.4 - 0.6 typical)
            if best_index >= 0 and best_score > 0.5:
                roll = student_roll_map[best_index]
                present_students.add(roll)

        all_students = student_roll_map

        absent_students = [
            roll for roll in all_students
            if roll not in present_students
        ]

        return {
            "success": True,
            "presentStudents": list(present_students),
            "absentStudents": absent_students
        }

    except Exception as e:
        return {
            "success": False,
            "message": "Attendance processing failed",
            "error": str(e)
        }


# =========================
# EMBEDDING GENERATION API
# =========================
@router.post("/generate-embedding")
async def generate_embedding(file: UploadFile = File(...)):
    try:
        model = get_recognition_model()

        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return {"success": False, "message": "Invalid image"}

        faces = model.get(img)

        if len(faces) == 0:
            return {"success": False, "message": "No face detected"}

        embedding = faces[0].embedding.astype(np.float32)
        embedding = normalize(embedding)

        return {
            "success": True,
            "embedding": embedding.tolist()
        }

    except Exception as e:
        return {
            "success": False,
            "message": "Embedding generation failed",
            "error": str(e)
        }


# =========================
# QUALITY SCORE API
# =========================
@router.post("/score")
async def get_quality_score(file: UploadFile = File(...)):
    try:
        model = get_detection_model()

        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return build_quality_response(
                score=0,
                confidence=0,
                faces_detected=0,
                message="Invalid image format"
            )

        faces = model.get(img)

        if not faces:
            return build_quality_response(
                score=0,
                confidence=0,
                faces_detected=0,
                message="No face detected"
            )

        num_faces = len(faces)
        confidence = max(float(face.det_score) for face in faces)

        if num_faces > 1:
            return build_quality_response(
                score=0.2,
                confidence=confidence,
                faces_detected=num_faces,
                message="Multiple faces detected"
            )

        return build_quality_response(
            score=confidence,
            confidence=confidence,
            faces_detected=num_faces,
            message="Quality analysis complete"
        )

    except Exception as e:
        return build_quality_response(
            score=0,
            confidence=0,
            faces_detected=0,
            message="Server error",
            error=str(e)
        )
