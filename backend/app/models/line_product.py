
from sqlalchemy import ForeignKey, SmallInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class LineProduct(Base):
    __tablename__ = "line_product"

    line_id: Mapped[int] = mapped_column(
        SmallInteger,
        ForeignKey("line.line_id"),
        primary_key=True,
    )

    product_id: Mapped[int] = mapped_column(
        SmallInteger,
        ForeignKey("product.product_id"),
        primary_key=True,
    )

    line: Mapped["Line"] = relationship(
        back_populates="allowed_products",
    )

    product: Mapped["Product"] = relationship(
        back_populates="allowed_lines",
    )

    daily_products: Mapped[list["DailyProduct"]] = relationship(
        back_populates="line_product",
    )
