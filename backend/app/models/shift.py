
from sqlalchemy import SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Shift(Base):
    __tablename__ = "shift"

    shift_id: Mapped[int] = mapped_column(
        SmallInteger,
        primary_key=True,
        autoincrement=True,
    )

    name: Mapped[str] = mapped_column(
        String(1),
        unique=True,
        nullable=False,
    )

    records: Mapped[list["Record"]] = relationship(
        back_populates="shift",
    )
