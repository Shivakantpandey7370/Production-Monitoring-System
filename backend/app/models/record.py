
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    ForeignKey,
    Numeric,
    SmallInteger,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Record(Base):
    __tablename__ = "record"

    record_id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    daily_product_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("daily_product.daily_product_id"),
        nullable=False,
    )

    shift_id: Mapped[int] = mapped_column(
        SmallInteger,
        ForeignKey("shift.shift_id"),
        nullable=False,
    )

    speed: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    production: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )

    energy: Mapped[Decimal] = mapped_column(
        Numeric(12, 3),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "daily_product_id",
            "shift_id",
            name="uq_daily_product_shift",
        ),
        CheckConstraint(
            "speed >= 0",
            name="ck_speed_nonnegative",
        ),
        CheckConstraint(
            "production >= 0",
            name="ck_production_nonnegative",
        ),
        CheckConstraint(
            "energy >= 0",
            name="ck_energy_nonnegative",
        ),
    )

    daily_product: Mapped["DailyProduct"] = relationship(
        back_populates="records",
    )

    shift: Mapped["Shift"] = relationship(
        back_populates="records",
    )
