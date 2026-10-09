from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

# ---------- User ----------

RoleType = Literal["job_seeker", "recruiter", "admin"]


class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=72)
    # Admin accounts are NOT self-registered (see ADMIN_EMAIL bootstrap in main.py)
    role: Literal["job_seeker", "recruiter"] = "job_seeker"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = None
    bio: Optional[str] = None
    skills: Optional[str] = None  # comma-separated


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    phone: Optional[str] = None
    bio: Optional[str] = None
    skills: Optional[str] = None
    resume_path: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------- Company ----------

class CompanyCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    website: Optional[str] = None
    location: Optional[str] = None


class CompanyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = None
    website: Optional[str] = None
    location: Optional[str] = None


class CompanyOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    website: Optional[str] = None
    location: Optional[str] = None
    owner_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------- Job ----------

JobType = Literal["full_time", "part_time", "contract", "internship", "remote"]


class JobCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    description: str = Field(..., min_length=10)
    location: Optional[str] = None
    job_type: JobType = "full_time"
    company_id: int
    is_active: bool = True


class JobUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = Field(None, min_length=10)
    location: Optional[str] = None
    job_type: Optional[JobType] = None
    is_active: Optional[bool] = None


class JobOut(BaseModel):
    id: int
    title: str
    description: str
    location: Optional[str] = None
    job_type: str
    is_active: bool
    company_id: int
    posted_by: Optional[int] = None
    created_at: datetime
    company: Optional[CompanyOut] = None

    model_config = ConfigDict(from_attributes=True)


# ---------- Application ----------

AppStatus = Literal["applied", "shortlisted", "rejected", "hired"]


class ApplicationCreate(BaseModel):
    cover_letter: Optional[str] = None


class ApplicationStatusUpdate(BaseModel):
    status: AppStatus


class ApplicationOut(BaseModel):
    id: int
    job_id: int
    applicant_id: int
    cover_letter: Optional[str] = None
    resume_path: Optional[str] = None
    status: str
    applied_at: datetime
    job: Optional[JobOut] = None
    applicant: Optional[UserOut] = None

    model_config = ConfigDict(from_attributes=True)


# ---------- Recruiter approval ----------

class RecruiterApply(BaseModel):
    company_name: Optional[str] = Field(None, max_length=255)
    message: Optional[str] = None


class RecruiterApplicationOut(BaseModel):
    id: int
    user_id: int
    company_name: Optional[str] = None
    message: Optional[str] = None
    status: str
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[int] = None
    applicant: Optional[UserOut] = None

    model_config = ConfigDict(from_attributes=True)


class RecruiterStatusOut(BaseModel):
    status: Optional[str] = None


class ApplicationReview(BaseModel):
    decision: Literal["approve", "reject"]
