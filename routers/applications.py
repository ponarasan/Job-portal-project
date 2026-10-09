from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user
from database import get_db

router = APIRouter(prefix="/applications", tags=["Application"])


@router.get("/me", response_model=list[schemas.ApplicationOut])
def my_applications(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Application status: job seeker sees all own applications + status."""
    return (
        db.query(models.Application)
        .filter(models.Application.applicant_id == current_user.id)
        .all()
    )


@router.get("/{application_id}", response_model=schemas.ApplicationOut)
def get_application(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    app = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if app.applicant_id != current_user.id:
        # allow company owner / admin to view
        job = db.query(models.Job).filter(models.Job.id == app.job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        company = db.query(models.Company).filter(models.Company.id == job.company_id).first()
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")
        if company.owner_id != current_user.id and current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Not authorized")
    return app


@router.patch("/{application_id}/status", response_model=schemas.ApplicationOut)
def update_status(
    application_id: int,
    payload: schemas.ApplicationStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Recruiter updates applicant status (shortlisted/rejected/hired)."""
    app = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    job = db.query(models.Job).filter(models.Job.id == app.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    company = db.query(models.Company).filter(models.Company.id == job.company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only the company owner can update status")
    app.status = payload.status
    db.commit()
    db.refresh(app)
    return app


@router.delete("/{application_id}", status_code=204)
def withdraw_application(
    application_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    app = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if app.applicant_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    db.delete(app)
    db.commit()
    return None
