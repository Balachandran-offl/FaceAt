from fastapi import FastAPI

print("STEP 1")

from rout import vision

print("STEP 2")

app = FastAPI(title="Retina")

print("STEP 3")

app.include_router(vision.router)

print("STEP 4")

@app.get("/")
def read_root():
    return {"message": "Python is running"}