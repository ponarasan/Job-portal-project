from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    # job_seeker | recruiter | admin
    role = Column(String(20), default="job_seeker", nullable=False)

    phone = Column(String(20), nullable=True)
    bio = Column(Text, nullable=True)
    skills = Column(Text, nullable=True)  # comma-separated, keep simple
    resume_path = Column(String(500), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    companies = relationship("Company", back_populates="owner", cascade="all, delete-orphan")
    applications = relationship("Application", back_populates="applicant", cascade="all, delete-orphan")
    posted_jobs = relationship("Job", back_populates="posted_by_user")


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    website = Column(String(255), nullable=True)
    location = Column(String(255), nullable=True)

    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="companies")
    jobs = relationship("Job", back_populates="company", cascade="all, delete-orphan")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=False)
    location = Column(String(255), nullable=True, index=True)
    # full_time | part_time | contract | internship | remote
    job_type = Column(String(20), default="full_time", index=True)
    is_active = Column(Boolean, default=True)

    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    posted_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company", back_populates="jobs")
    posted_by_user = relationship("User", back_populates="posted_jobs")
    applications = relationship("Application", back_populates="job", cascade="all, delete-orphan")


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    applicant_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    cover_letter = Column(Text, nullable=True)
    resume_path = Column(String(500), nullable=True)  # snapshot of resume at apply time
    # applied | shortlisted | rejected | hired
    status = Column(String(20), default="applied", nullable=False)
    applied_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("job_id", "applicant_id", name="uq_job_applicant"),)

    job = relationship("Job", back_populates="applications")
    applicant = relationship("User", back_populates="applications")


class RecruiterApplication(Base):
    """A recruiter's request for posting rights. Admin approves/rejects."""

    __tablename__ = "recruiter_applications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    company_name = Column(String(255), nullable=True)
    message = Column(Text, nullable=True)
    # pending | approved | rejected
    status = Column(String(20), default="pending", nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    applicant = relationship("User", foreign_keys=[user_id])
