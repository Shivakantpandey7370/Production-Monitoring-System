
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


class ProductionRecordCreate(BaseModel):
    production_date: date
    line_id: int = Field(gt=0)
    product_id: int = Field(gt=0)
    shift_id: int = Field(gt=0)

    production_quantity: int = Field(ge=0)
    line_speed: Decimal = Field(ge=0)
    energy_consumed: Decimal = Field(ge=0)




class ProductionRecordUpdate(BaseModel):
    production_quantity: int = Field(ge=0)
    line_speed: Decimal = Field(ge=0)
    energy_consumed: Decimal = Field(ge=0)
