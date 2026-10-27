
from datetime import date

from sqlalchemy import (
    BigInteger,
    Date,
    ForeignKeyConstraint,
    SmallInteger,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DailyProduct(Base):
    __tablename__ = "daily_product"

    daily_product_id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    work_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )

    line_id: Mapped[int] = mapped_column(
        SmallInteger,
        nullable=False,
    )

    product_id: Mapped[int] = mapped_column(
        SmallInteger,
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "work_date",
            "line_id",
            name="uq_date_line",
        ),
        ForeignKeyConstraint(
            ["line_id", "product_id"],
            ["line_product.line_id", "line_product.product_id"],
            name="fk_daily_allowed_product",
        ),
    )

    line_product: Mapped["LineProduct"] = relationship(
        back_populates="daily_products",
    )

    records: Mapped[list["Record"]] = relationship(
        back_populates="daily_product",
    )
