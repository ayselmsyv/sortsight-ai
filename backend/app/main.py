
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.sorting import router as sorting_router

app = FastAPI(
    title="SortSight AI",
    description="Package sorting and operations API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sorting_router)


@app.get("/")
def home():
    return {"message": "SortSight AI API is running"}
