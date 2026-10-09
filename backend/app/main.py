
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import inspection
from app.routers.sorting import router as sorting_router

app = FastAPI(
    title="SortSight AI",
    description="Package inspection, sorting and operations API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", 
                   "http://127.0.0.1:3000",
                    "https://sortsight-ai.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Person 1 - AI Inspection
app.include_router(inspection.router)

# Person 2 - Sorting
app.include_router(sorting_router)


@app.get("/")
def home():
    return {"message": "SortSight AI API is running"}


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
