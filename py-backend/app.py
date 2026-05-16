from fastapi import FastAPI
from rout import vision
import uvicorn
import sys
print("Python executable used by Spark:", sys.executable)
app=FastAPI(title="Retina")
app.include_router(vision.router)
@app.get("/")
def read_root():
    return {"message":"Python is running"}
if __name__=="__main__":
    uvicorn.run(app,host="0.0.0.0",port=8000)