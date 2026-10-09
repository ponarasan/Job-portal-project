import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from database import Base, SessionLocal, engine

import models  # noqa: F401  (register tables)
from routers import admin, applications, companies, jobs, recruiter, users

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"
UPLOAD_DIR = BASE_DIR / "uploads"
RESUME_DIR = UPLOAD_DIR / "resumes"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Don't crash the whole import/startup if MySQL is down;
    # /ready will report DB status instead.
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as exc:  # noqa: BLE001
        print(f"WARNING: could not init DB tables: {exc}")
        yield
        return
    # Bootstrap the first admin from env (public registration can't create admins).
    try:
        from auth import hash_password

        admin_email = os.getenv("ADMIN_EMAIL")
        admin_password = os.getenv("ADMIN_PASSWORD")
        if admin_email and admin_password:
            s = SessionLocal()
            try:
                if not s.query(models.User).filter(models.User.email == admin_email).first():
                    s.add(
                        models.User(
                            name="Admin",
                            email=admin_email,
                            hashed_password=hash_password(admin_password),
                            role="admin",
                        )
                    )
                    s.commit()
                    print(f"Bootstrapped admin {admin_email}")
            finally:
                s.close()
    except Exception as exc:  # noqa: BLE001
        print(f"WARNING: admin bootstrap failed: {exc}")
    yield


app = FastAPI(title="Job Portal API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # must be False when origins is "*"
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(companies.router)
app.include_router(jobs.router)
app.include_router(applications.router)
app.include_router(recruiter.router)
app.include_router(admin.router)


@app.get("/", include_in_schema=False)
def root():
    # Hitting http://127.0.0.1:8000/ used to return 404 ("Not Found"),
    # which looked like the server didn't start. Redirect to the UI.
    if FRONTEND_DIR.is_dir():
        return RedirectResponse(url="/app/")
    return RedirectResponse(url="/docs")


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}


@app.get("/ready", tags=["Health"])
def ready():
    """App + DB readiness (MySQL down -> 503 instead of import crash)."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ready", "db": "up"}
    except Exception as exc:  # noqa: BLE001
        from fastapi.responses import JSONResponse

        return JSONResponse(
            status_code=503,
            content={"status": "not-ready", "db": "down", "detail": str(exc)[:300]},
        )


# Serve frontend (no build step) at /app
if FRONTEND_DIR.is_dir():
    app.mount("/app", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")

# Serve uploaded resumes so recruiters can open them via the stored resume_path
RESUME_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


if __name__ == "__main__":
    import uvicorn

    # `python main.py` previously exited silently (did nothing).
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)
