from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user, get_recruiter_status
from database import get_db

router = APIRouter(prefix="/recruiter", tags=["Recruiter"])


@router.post("/apply", response_model=schemas.RecruiterApplicationOut, status_code=201)
def apply(
    payload: schemas.RecruiterApply,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Submit (or resubmit after rejection) a recruiter application."""
    if current_user.role != "recruiter":
        raise HTTPException(status_code=403, detail="Only recruiter accounts can apply.")
    existing = (
        db.query(models.RecruiterApplication)
        .filter(models.RecruiterApplication.user_id == current_user.id)
        .first()
    )
    if existing and existing.status == "approved":
        raise HTTPException(status_code=400, detail="Recruiter already approved.")
    if existing:
        existing.status = "pending"
        existing.company_name = payload.company_name
        existing.message = payload.message
        existing.reviewed_at = None
        existing.reviewed_by = None
    else:
        existing = models.RecruiterApplication(
            user_id=current_user.id,
            company_name=payload.company_name,
            message=payload.message,
            status="pending",
        )
        db.add(existing)
    db.commit()
    db.refresh(existing)
    return existing


@router.get("/status", response_model=schemas.RecruiterStatusOut)
def status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return {"status": get_recruiter_status(db, current_user)}
