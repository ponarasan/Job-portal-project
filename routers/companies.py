from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user, require_recruiter
from database import get_db

router = APIRouter(prefix="/companies", tags=["Company"])


@router.post("", response_model=schemas.CompanyOut, status_code=201)
def create_company(
    payload: schemas.CompanyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_recruiter),
):
    company = models.Company(**payload.model_dump(), owner_id=current_user.id)
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@router.get("", response_model=list[schemas.CompanyOut])
def list_companies(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    return db.query(models.Company).offset(skip).limit(limit).all()


@router.get("/me", response_model=list[schemas.CompanyOut])
def my_companies(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_recruiter),
):
    return db.query(models.Company).filter(models.Company.owner_id == current_user.id).all()


@router.get("/{company_id}", response_model=schemas.CompanyOut)
def get_company(company_id: int, db: Session = Depends(get_db)):
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.put("/{company_id}", response_model=schemas.CompanyOut)
def update_company(
    company_id: int,
    payload: schemas.CompanyUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not the company owner")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(company, k, v)
    db.commit()
    db.refresh(company)
    return company


@router.delete("/{company_id}", status_code=204)
def delete_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not the company owner")
    db.delete(company)
    db.commit()
    return None


@router.get("/{company_id}/applicants", response_model=list[schemas.ApplicationOut])
def manage_applicants(
    company_id: int,
    job_id: int | None = None,
    app_status: str | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Manage applicants: list everyone who applied to this company's jobs."""
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    if company.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not the company owner")

    q = (
        db.query(models.Application)
        .join(models.Job, models.Application.job_id == models.Job.id)
        .filter(models.Job.company_id == company_id)
    )
    if job_id:
        q = q.filter(models.Application.job_id == job_id)
    if app_status:
        q = q.filter(models.Application.status == app_status)
    return q.all()
