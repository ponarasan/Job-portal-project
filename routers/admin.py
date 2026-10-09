from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from auth import require_admin
from database import get_db

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/applications", response_model=list[schemas.RecruiterApplicationOut])
def list_applications(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    """Admin dashboard: list recruiter applications, optionally filtered."""
    q = db.query(models.RecruiterApplication).order_by(
        models.RecruiterApplication.created_at.desc()
    )
    if status:
        q = q.filter(models.RecruiterApplication.status == status)
    return q.all()


@router.patch("/applications/{app_id}", response_model=schemas.RecruiterApplicationOut)
def review_application(
    app_id: int,
    payload: schemas.ApplicationReview,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    """APPROVE activates the recruiter (can post jobs); REJECT blocks them."""
    app = (
        db.query(models.RecruiterApplication)
        .filter(models.RecruiterApplication.id == app_id)
        .first()
    )
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    app.status = "approved" if payload.decision == "approve" else "rejected"
    app.reviewed_at = datetime.utcnow()
    app.reviewed_by = admin.id
    db.commit()
    db.refresh(app)
    return app
