from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text, JSON, Integer
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from app.core.database import Base

def generate_uuid():
    return str(uuid.uuid4())

def utc_now():
    return datetime.now(timezone.utc)

class App(Base):
    __tablename__ = "apps"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    owner = Column(String(255), nullable=False)
    criticality = Column(String(32), nullable=False, default="standard") # critical, standard, batch
    created_at = Column(DateTime(timezone=True), default=utc_now)

    budgets = relationship("Budget", back_populates="app", cascade="all, delete-orphan")
    usages = relationship("Usage", back_populates="app", cascade="all, delete-orphan")
    ledger_entries = relationship("LedgerEntry", back_populates="app", cascade="all, delete-orphan")
    workload_state = relationship("WorkloadState", back_populates="app", uselist=False, cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="app", cascade="all, delete-orphan")

class Budget(Base):
    __tablename__ = "budgets"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    app_id = Column(String(64), ForeignKey("apps.id", ondelete="CASCADE"), nullable=False, index=True)
    period_start = Column(DateTime(timezone=True), nullable=False)
    period_end = Column(DateTime(timezone=True), nullable=False)
    limit_gco2e = Column(Float, nullable=False)
    consumed_gco2e = Column(Float, nullable=False, default=0.0)
    action = Column(String(32), nullable=False, default="PAUSE") # PAUSE, THROTTLE, ALERT_ONLY
    status = Column(String(32), nullable=False, default="ACTIVE") # ACTIVE, WARNING, DEPLETED, OVERRIDDEN
    created_at = Column(DateTime(timezone=True), default=utc_now)

    app = relationship("App", back_populates="budgets")
    ledger_entries = relationship("LedgerEntry", back_populates="budget")

class Usage(Base):
    __tablename__ = "usages"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    app_id = Column(String(64), ForeignKey("apps.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, default=utc_now, index=True)
    energy_wh = Column(Float, nullable=False)
    carbon_g = Column(Float, nullable=False)
    source = Column(String(64), nullable=False) # simulated, docker-meter, rapl
    region = Column(String(64), nullable=False, default="us-east-1")
    carbon_intensity = Column(Float, nullable=False, default=380.0)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    app = relationship("App", back_populates="usages")

class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    app_id = Column(String(64), ForeignKey("apps.id", ondelete="CASCADE"), nullable=False, index=True)
    budget_id = Column(String(64), ForeignKey("budgets.id", ondelete="SET NULL"), nullable=True, index=True)
    delta_g = Column(Float, nullable=False)
    reason = Column(String(255), nullable=False)
    idempotency_key = Column(String(128), unique=True, nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, default=utc_now)

    app = relationship("App", back_populates="ledger_entries")
    budget = relationship("Budget", back_populates="ledger_entries")

class WorkloadState(Base):
    __tablename__ = "workload_states"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    app_id = Column(String(64), ForeignKey("apps.id", ondelete="CASCADE"), unique=True, nullable=False)
    status = Column(String(32), nullable=False, default="RUNNING") # RUNNING, PAUSED, THROTTLED, OVERRIDDEN
    concurrency_cap = Column(Integer, nullable=False, default=100) # percentage 0 to 100
    override_reason = Column(String(255), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    app = relationship("App", back_populates="workload_state")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    app_id = Column(String(64), ForeignKey("apps.id", ondelete="CASCADE"), nullable=True, index=True)
    action = Column(String(64), nullable=False) # PAUSE_WORKLOAD, RESUME_WORKLOAD, POLICY_OVERRIDE, BUDGET_CREATED, BUDGET_DEPLETED
    details = Column(JSON, nullable=False)
    reason = Column(String(255), nullable=True)
    actor = Column(String(128), nullable=False, default="policy-engine")
    timestamp = Column(DateTime(timezone=True), default=utc_now, index=True)

    app = relationship("App", back_populates="audit_logs")
