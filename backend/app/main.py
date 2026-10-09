from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import inspection

app = FastAPI(title="SortSight AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(inspection.router)
