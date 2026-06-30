from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

print("STEP 1")

from rout import vision

print("STEP 2")

app = FastAPI(title="Retina")

print("STEP 3")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vision.router)

print("STEP 4")

@app.get("/")
def read_root():
    return {"message": "Python is running"}
