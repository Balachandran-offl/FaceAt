from fastapi import APIRouter, File, UploadFile
from pymongo import MongoClient
from retinaface import RetinaFace
from insightface.app import FaceAnalysis

import faiss
import numpy as np
import cv2
import os
import sys

router = APIRouter()

# =========================
# MONGO SETUP
# =========================
client = MongoClient("mongodb+srv://Balachandran:DyNPSTJy8HWwRxHm@attendencecluster.uicwhnh.mongodb.net/?appName=Attendencecluster")
db = client["test"]
embedding_collection = db["studentEmbeddings"]

# =========================
# FAISS SETUP
# =========================
EMBEDDING_DIM = 512
faiss_index = faiss.IndexFlatIP(EMBEDDING_DIM)  # cosine similarity via dot product
student_roll_map = []

# =========================
# FACE MODEL (InsightFace)
# =========================
face_model = None


def get_face_model():
    global face_model

    if face_model is not None:
        return face_model

    model = FaceAnalysis(
        name="buffalo_l",
        providers=["CPUExecutionProvider"],
        allowed_modules=["detection", "recognition"]
    )
    model.prepare(ctx_id=-1)

    face_model = model
    return model


# =========================
# NORMALIZE VECTOR
# =========================
def normalize(vec):
    norm = np.linalg.norm(vec)
    if norm == 0:
        return vec
    return vec / norm


# =========================
# BUILD FAISS INDEX
# =========================
def build_faiss_index():
    global faiss_index, student_roll_map

    students = list(embedding_collection.find({}))

    vectors = []
    student_roll_map = []

    for student in students:
        emb = np.array(student["embedding"], dtype=np.float32)
        emb = normalize(emb)

        vectors.append(emb)
        student_roll_map.append(student["rollNumber"])

    if len(vectors) == 0:
        return

    vectors = np.array(vectors, dtype=np.float32)
    faiss_index.add(vectors)


# build once at startup
build_faiss_index()


# =========================
# ATTENDANCE API
# =========================
@router.post("/process-attendance")
async def process_attendance(file: UploadFile = File(...)):
    try:
        model = get_face_model()

        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return {"success": False, "message": "Invalid image"}

        faces = model.get(img)

        if len(faces) == 0:
            return {"success": False, "message": "No faces detected"}

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
            if best_score > 0.5:
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
        model = get_face_model()

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
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return {"score": 0, "message": "Invalid image format"}

        faces = RetinaFace.detect_faces(img)

        if not faces or not isinstance(faces, dict):
            return {"score": 0, "message": "No face detected"}

        num_faces = len(faces)
        first_key = list(faces.keys())[0]
        confidence = faces[first_key]["score"]

        if num_faces > 1:
            return {
                "score": 0.2,
                "faces": num_faces,
                "message": "Multiple faces detected"
            }

        return {
            "score": round(float(confidence), 2),
            "faces": num_faces,
            "message": "Quality analysis complete"
        }

    except Exception as e:
        return {
            "score": 0,
            "error": str(e),
            "message": "Server error"
        }