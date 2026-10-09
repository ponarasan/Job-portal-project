from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

import os

import models
import schemas
from auth import get_current_user, require_recruiter
from database import get_db

router = APIRouter(prefix="/jobs", tags=["Job"])

UPLOAD_DIR = str(Path(__file__).resolve().parent.parent / "uploads" / "resumes")
ALLOWED_EXT = {".pdf", ".doc", ".docx"}
MAX_SIZE = 5 * 1024 * 1024  # 5 MB


@router.post("", response_model=schemas.JobOut, status_code=201)
def post_job(
    payload: schemas.JobCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_recruiter),
):
    company = (
        db.query(models.Company).filter(models.Company.id == payload.company_id).first()
    )
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="You don't own this company")
    job = models.Job(
        **payload.model_dump(), posted_by=current_user.id,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.get("", response_model=list[schemas.JobOut])
def list_jobs(
    db: Session = Depends(get_db),
):
    """List all active jobs."""
    return db.query(models.Job).filter(models.Job.is_active == True).all()  # noqa: E712


@router.get("/{job_id}", response_model=schemas.JobOut)
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.put("/{job_id}", response_model=schemas.JobOut)
def update_job(
    job_id: int,
    payload: schemas.JobUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    company = db.query(models.Company).filter(models.Company.id == job.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not the job owner")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(job, k, v)
    db.commit()
    db.refresh(job)
    return job


@router.delete("/{job_id}", status_code=204)
def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    company = db.query(models.Company).filter(models.Company.id == job.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not the job owner")
    db.delete(job)
    db.commit()
    return None


# ---------- Apply ----------

@router.post("/{job_id}/apply", response_model=schemas.ApplicationOut, status_code=201)
def apply_job(
    job_id: int,
    file: UploadFile = File(..., description="Resume file (pdf/doc/docx, max 5 MB)"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Apply with a resume upload (replaces cover letter)."""
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job or not job.is_active:
        raise HTTPException(status_code=404, detail="Job not found or closed")
    existing = (
        db.query(models.Application)
        .filter(
            models.Application.job_id == job_id,
            models.Application.applicant_id == current_user.id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Already applied to this job")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(
            status_code=400, detail=f"Only {', '.join(sorted(ALLOWED_EXT))} files allowed"
        )
    contents = file.file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 5 MB)")
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    dest = os.path.join(UPLOAD_DIR, f"app_{current_user.id}_{job_id}{ext}")
    with open(dest, "wb") as f:
        f.write(contents)

    # keep profile resume in sync with the latest upload
    current_user.resume_path = dest

    app = models.Application(
        job_id=job_id,
        applicant_id=current_user.id,
        cover_letter=None,
        resume_path=dest,
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    return app


@router.get("/{job_id}/applications", response_model=list[schemas.ApplicationOut])
def list_job_applicants(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    company = db.query(models.Company).filter(models.Company.id == job.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not the job owner")
    return (
        db.query(models.Application)
        .filter(models.Application.job_id == job_id)
        .all()
    )
