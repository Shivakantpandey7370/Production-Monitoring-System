
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import date

from sqlalchemy import func
from app.schemas.production import ProductionRecordUpdate 

from app.database import get_db
from app.models import (
    Line,
    Product,
    Shift,
    LineProduct,
    DailyProduct,
    Record,
)
from app.schemas.production import ProductionRecordCreate

router = APIRouter(
    prefix="/api/v1",
    tags=["Production"],
)


@router.post("/production-records", status_code=201)
def create_production_record(
    data: ProductionRecordCreate,
    db: Session = Depends(get_db),
):
    # 1. Check line exists
    line = db.query(Line).filter(
        Line.line_id == data.line_id
    ).first()

    if line is None:
        raise HTTPException(
            status_code=404,
            detail="Line not found",
        )

    # 2. Check product exists
    product = db.query(Product).filter(
        Product.product_id == data.product_id
    ).first()

    if product is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found",
        )

    # 3. Check shift exists
    shift = db.query(Shift).filter(
        Shift.shift_id == data.shift_id
    ).first()

    if shift is None:
        raise HTTPException(
            status_code=404,
            detail="Shift not found",
        )

    # 4. Check selected product is allowed on this line
    allowed = db.query(LineProduct).filter(
        LineProduct.line_id == data.line_id,
        LineProduct.product_id == data.product_id,
    ).first()

    if allowed is None:
        raise HTTPException(
            status_code=400,
            detail="This product is not allowed on this line",
        )

    # 5. Check whether this line already has a product
    # for the selected date
    daily_product = db.query(DailyProduct).filter(
        DailyProduct.work_date == data.production_date,
        DailyProduct.line_id == data.line_id,
    ).first()

    if daily_product is not None:
        if daily_product.product_id != data.product_id:
            raise HTTPException(
                status_code=409,
                detail="A different product is already assigned to this line for this date",
            )

    else:
        daily_product = DailyProduct(
            work_date=data.production_date,
            line_id=data.line_id,
            product_id=data.product_id,
        )
        db.add(daily_product)
        db.flush()

    # 6. Check duplicate record for the same shift
    existing_record = db.query(Record).filter(
        Record.daily_product_id == daily_product.daily_product_id,
        Record.shift_id == data.shift_id,
    ).first()

    if existing_record is not None:
        raise HTTPException(
            status_code=409,
            detail="A record already exists for this line, date and shift",
        )

    # 7. Save production details
    record = Record(
        daily_product_id=daily_product.daily_product_id,
        shift_id=data.shift_id,
        production=data.production_quantity,
        speed=data.line_speed,
        energy=data.energy_consumed,
    )

    db.add(record)

    try:
        db.commit()
        db.refresh(record)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Duplicate or invalid production record",
        )

    return {
        "message": "Production record saved successfully",
        "record_id": record.record_id,
        "production_date": data.production_date,
        "line_id": data.line_id,
        "product_id": data.product_id,
        "shift_id": data.shift_id,
        "production_quantity": record.production,
        "line_speed": record.speed,
        "energy_consumed": record.energy,
    }



@router.get("/production-records")
def get_production_records(
    production_date: date,
    db: Session = Depends(get_db),
):
    records = (
        db.query(Record, DailyProduct, Line, Product, Shift)
        .join(
            DailyProduct,
            Record.daily_product_id == DailyProduct.daily_product_id,
        )
        .join(Line, DailyProduct.line_id == Line.line_id)
        .join(Product, DailyProduct.product_id == Product.product_id)
        .join(Shift, Record.shift_id == Shift.shift_id)
        .filter(DailyProduct.work_date == production_date)
        .order_by(Line.line_id, Shift.shift_id)
        .all()
    )

    return [
        {
            "record_id": record.record_id,
            "production_date": daily_product.work_date,
            "line_id": line.line_id,
            "line_name": line.name,
            "product_id": product.product_id,
            "product_name": product.name,
            "shift_id": shift.shift_id,
            "shift_name": shift.name,
            "production_quantity": record.production,
            "line_speed": record.speed,
            "energy_consumed": record.energy,
        }
        for record, daily_product, line, product, shift in records
    ]




@router.put("/production-records/{record_id}")
def update_production_record(
    record_id: int,
    data: ProductionRecordUpdate,
    db: Session = Depends(get_db),
):
    record = db.query(Record).filter(
        Record.record_id == record_id
    ).first()

    if record is None:
        raise HTTPException(
            status_code=404,
            detail="Production record not found",
        )

    record.production = data.production_quantity
    record.speed = data.line_speed
    record.energy = data.energy_consumed

    try:
        db.commit()
        db.refresh(record)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Could not update production record",
        )

    return {
        "message": "Production record updated successfully",
        "record_id": record.record_id,
        "production_quantity": record.production,
        "line_speed": record.speed,
        "energy_consumed": record.energy,
    }



@router.get("/reports/daily")
def get_daily_report(
    report_date: date,
    db: Session = Depends(get_db),
):
    # 1. Daily total aur average speed
    totals = (
        db.query(
            func.coalesce(func.sum(Record.production), 0),
            func.coalesce(func.sum(Record.energy), 0),
            func.avg(Record.speed),
        )
        .join(
            DailyProduct,
            Record.daily_product_id == DailyProduct.daily_product_id,
        )
        .filter(DailyProduct.work_date == report_date)
        .first()
    )

    # 2. Line-wise report
    line_totals = (
        db.query(
            Line.name,
            func.sum(Record.production).label("production"),
            func.sum(Record.energy).label("energy"),
            func.avg(Record.speed).label("average_speed"),
        )
        .join(DailyProduct, DailyProduct.line_id == Line.line_id)
        .join(
            Record,
            Record.daily_product_id == DailyProduct.daily_product_id,
        )
        .filter(DailyProduct.work_date == report_date)
        .group_by(Line.line_id, Line.name)
        .order_by(Line.line_id)
        .all()
    )

    # 3. Shift-wise report
    shift_totals = (
        db.query(
            Shift.name,
            func.sum(Record.production).label("production"),
            func.sum(Record.energy).label("energy"),
            func.avg(Record.speed).label("average_speed"),
        )
        .join(Record, Record.shift_id == Shift.shift_id)
        .join(
            DailyProduct,
            Record.daily_product_id == DailyProduct.daily_product_id,
        )
        .filter(DailyProduct.work_date == report_date)
        .group_by(Shift.shift_id, Shift.name)
        .order_by(Shift.shift_id)
        .all()
    )

    # 4. Product-wise report
    product_totals = (
        db.query(
            Product.name,
            func.sum(Record.production).label("production"),
            func.sum(Record.energy).label("energy"),
        )
        .join(
            DailyProduct,
            DailyProduct.product_id == Product.product_id,
        )
        .join(
            Record,
            Record.daily_product_id == DailyProduct.daily_product_id,
        )
        .filter(DailyProduct.work_date == report_date)
        .group_by(Product.product_id, Product.name)
        .order_by(Product.product_id)
        .all()
    )

    return {
        "report_date": report_date,
        "total_production": totals[0],
        "total_energy": totals[1],
        "average_speed": totals[2],
        "by_line": [
            {
                "line_name": row[0],
                "production": row[1],
                "energy": row[2],
                "average_speed": row[3],
            }
            for row in line_totals
        ],
        "by_shift": [
            {
                "shift_name": row[0],
                "production": row[1],
                "energy": row[2],
                "average_speed": row[3],
            }
            for row in shift_totals
        ],
        "by_product": [
            {
                "product_name": row[0],
                "production": row[1],
                "energy": row[2],
            }
            for row in product_totals
        ],
    }




@router.get("/reports/monthly")
def get_monthly_report(
    year: int,
    month: int,
    db: Session = Depends(get_db),
):
    # Validate year and month
    if year < 1 or month < 1 or month > 12:
        raise HTTPException(
            status_code=400,
            detail="Provide a valid year and month (1-12)",
        )

    # Calculate the selected month's date range
    month_start = date(year, month, 1)

    if month == 12:
        next_month_start = date(year + 1, 1, 1)
    else:
        next_month_start = date(year, month + 1, 1)

    # Common monthly filter
    monthly_filter = (
        DailyProduct.work_date >= month_start,
        DailyProduct.work_date < next_month_start,
    )

    # 1. Monthly totals
    totals = (
        db.query(
            func.coalesce(func.sum(Record.production), 0),
            func.coalesce(func.sum(Record.energy), 0),
            func.avg(Record.speed),
        )
        .join(
            DailyProduct,
            Record.daily_product_id == DailyProduct.daily_product_id,
        )
        .filter(*monthly_filter)
        .first()
    )

    # 2. Line-wise totals
    line_totals = (
        db.query(
            Line.name,
            func.sum(Record.production),
            func.sum(Record.energy),
            func.avg(Record.speed),
        )
        .join(DailyProduct, DailyProduct.line_id == Line.line_id)
        .join(
            Record,
            Record.daily_product_id == DailyProduct.daily_product_id,
        )
        .filter(*monthly_filter)
        .group_by(Line.line_id, Line.name)
        .order_by(Line.line_id)
        .all()
    )

    # 3. Shift-wise totals
    shift_totals = (
        db.query(
            Shift.name,
            func.sum(Record.production),
            func.sum(Record.energy),
            func.avg(Record.speed),
        )
        .join(Record, Record.shift_id == Shift.shift_id)
        .join(
            DailyProduct,
            Record.daily_product_id == DailyProduct.daily_product_id,
        )
        .filter(*monthly_filter)
        .group_by(Shift.shift_id, Shift.name)
        .order_by(Shift.shift_id)
        .all()
    )

    # 4. Product-wise totals
    product_totals = (
        db.query(
            Product.name,
            func.sum(Record.production),
            func.sum(Record.energy),
        )
        .join(
            DailyProduct,
            DailyProduct.product_id == Product.product_id,
        )
        .join(
            Record,
            Record.daily_product_id == DailyProduct.daily_product_id,
        )
        .filter(*monthly_filter)
        .group_by(Product.product_id, Product.name)
        .order_by(Product.product_id)
        .all()
    )

    return {
        "year": year,
        "month": month,
        "total_production": totals[0],
        "total_energy": totals[1],
        "average_speed": totals[2],
        "by_line": [
            {
                "line_name": row[0],
                "production": row[1],
                "energy": row[2],
                "average_speed": row[3],
            }
            for row in line_totals
        ],
        "by_shift": [
            {
                "shift_name": row[0],
                "production": row[1],
                "energy": row[2],
                "average_speed": row[3],
            }
            for row in shift_totals
        ],
        "by_product": [
            {
                "product_name": row[0],
                "production": row[1],
                "energy": row[2],
            }
            for row in product_totals
        ],
    }




@router.get("/reports/production-trend")
def get_production_trend(
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db),
):
    # Check date range
    if start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date cannot be after end_date",
        )

    # 1. Total production for each date
    daily_totals = (
        db.query(
            DailyProduct.work_date.label("work_date"),
            func.sum(Record.production).label("total_production"),
        )
        .join(
            Record,
            Record.daily_product_id == DailyProduct.daily_product_id,
        )
        .filter(
            DailyProduct.work_date >= start_date,
            DailyProduct.work_date <= end_date,
        )
        .group_by(DailyProduct.work_date)
        .order_by(DailyProduct.work_date)
        .all()
    )

    # 2. Production for each line on each date
    line_totals = (
        db.query(
            DailyProduct.work_date.label("work_date"),
            Line.name.label("line_name"),
            func.sum(Record.production).label("production"),
        )
        .join(
            Record,
            Record.daily_product_id == DailyProduct.daily_product_id,
        )
        .join(Line, DailyProduct.line_id == Line.line_id)
        .filter(
            DailyProduct.work_date >= start_date,
            DailyProduct.work_date <= end_date,
        )
        .group_by(
            DailyProduct.work_date,
            Line.line_id,
            Line.name,
        )
        .order_by(
            DailyProduct.work_date,
            Line.line_id,
        )
        .all()
    )

    return {
        "start_date": start_date,
        "end_date": end_date,
        "daily_totals": [
            {
                "date": row.work_date,
                "total_production": row.total_production,
            }
            for row in daily_totals
        ],
        "by_line": [
            {
                "date": row.work_date,
                "line_name": row.line_name,
                "production": row.production,
            }
            for row in line_totals
        ],
    }




@router.get("/reports/energy-trend")
def get_energy_trend(
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db),
):
    if start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date cannot be after end_date",
        )

    # 1. Har date ki total energy
    daily_totals = (
        db.query(
            DailyProduct.work_date.label("work_date"),
            func.sum(Record.energy).label("total_energy"),
        )
        .join(
            Record,
            Record.daily_product_id == DailyProduct.daily_product_id,
        )
        .filter(
            DailyProduct.work_date >= start_date,
            DailyProduct.work_date <= end_date,
        )
        .group_by(DailyProduct.work_date)
        .order_by(DailyProduct.work_date)
        .all()
    )

    # 2. Har date par har line ki energy
    line_totals = (
        db.query(
            DailyProduct.work_date.label("work_date"),
            Line.name.label("line_name"),
            func.sum(Record.energy).label("energy"),
        )
        .join(
            Record,
            Record.daily_product_id == DailyProduct.daily_product_id,
        )
        .join(
            Line,
            DailyProduct.line_id == Line.line_id,
        )
        .filter(
            DailyProduct.work_date >= start_date,
            DailyProduct.work_date <= end_date,
        )
        .group_by(
            DailyProduct.work_date,
            Line.line_id,
            Line.name,
        )
        .order_by(
            DailyProduct.work_date,
            Line.line_id,
        )
        .all()
    )

    return {
        "start_date": start_date,
        "end_date": end_date,
        "daily_totals": [
            {
                "date": row.work_date,
                "total_energy": row.total_energy,
            }
            for row in daily_totals
        ],
        "by_line": [
            {
                "date": row.work_date,
                "line_name": row.line_name,
                "energy": row.energy,
            }
            for row in line_totals
        ],
    }




@router.get("/reports/shift-comparison")
def get_shift_comparison(
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db),
):
    if start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date cannot be after end_date",
        )

    results = (
        db.query(
            Shift.name.label("shift_name"),
            func.sum(Record.production).label("total_production"),
            func.sum(Record.energy).label("total_energy"),
            func.avg(Record.speed).label("average_speed"),
        )
        .join(Record, Record.shift_id == Shift.shift_id)
        .join(
            DailyProduct,
            DailyProduct.daily_product_id == Record.daily_product_id,
        )
        .filter(
            DailyProduct.work_date >= start_date,
            DailyProduct.work_date <= end_date,
        )
        .group_by(Shift.shift_id, Shift.name)
        .order_by(Shift.shift_id)
        .all()
    )

    return {
        "start_date": start_date,
        "end_date": end_date,
        "shifts": [
            {
                "shift_name": row.shift_name,
                "total_production": row.total_production,
                "total_energy": row.total_energy,
                "average_speed": (
                    round(float(row.average_speed), 2)
                    if row.average_speed is not None
                    else 0
                ),
            }
            for row in results
        ],
    }



@router.get("/reports/line-product-summary")
def get_line_product_summary(
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db),
):
    if start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date cannot be after end_date",
        )

    results = (
        db.query(
            Line.name.label("line_name"),
            Product.name.label("product_name"),
            func.sum(Record.production).label("total_production"),
            func.sum(Record.energy).label("total_energy"),
        )
        .join(
            DailyProduct,
            DailyProduct.line_id == Line.line_id,
        )
        .join(
            Product,
            Product.product_id == DailyProduct.product_id,
        )
        .join(
            Record,
            Record.daily_product_id == DailyProduct.daily_product_id,
        )
        .filter(
            DailyProduct.work_date >= start_date,
            DailyProduct.work_date <= end_date,
        )
        .group_by(
            Line.line_id,
            Line.name,
            Product.product_id,
            Product.name,
        )
        .order_by(
            Line.line_id,
            Product.product_id,
        )
        .all()
    )

    return {
        "start_date": start_date,
        "end_date": end_date,
        "items": [
            {
                "line_name": row.line_name,
                "product_name": row.product_name,
                "total_production": row.total_production,
                "total_energy": row.total_energy,
            }
            for row in results
        ],
    }




@router.get("/reports/line-speed-trend")
def get_line_speed_trend(
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db),
):
    if start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date cannot be after end_date",
        )

    # 1. Har date ki average line speed
    daily_totals = (
        db.query(
            DailyProduct.work_date.label("work_date"),
            func.avg(Record.speed).label("average_speed"),
        )
        .join(
            Record,
            Record.daily_product_id == DailyProduct.daily_product_id,
        )
        .filter(
            DailyProduct.work_date >= start_date,
            DailyProduct.work_date <= end_date,
        )
        .group_by(DailyProduct.work_date)
        .order_by(DailyProduct.work_date)
        .all()
    )

    # 2. Har date par har line ki average speed
    line_totals = (
        db.query(
            DailyProduct.work_date.label("work_date"),
            Line.name.label("line_name"),
            func.avg(Record.speed).label("average_speed"),
        )
        .join(
            Record,
            Record.daily_product_id == DailyProduct.daily_product_id,
        )
        .join(
            Line,
            DailyProduct.line_id == Line.line_id,
        )
        .filter(
            DailyProduct.work_date >= start_date,
            DailyProduct.work_date <= end_date,
        )
        .group_by(
            DailyProduct.work_date,
            Line.line_id,
            Line.name,
        )
        .order_by(
            DailyProduct.work_date,
            Line.line_id,
        )
        .all()
    )

    return {
        "start_date": start_date,
        "end_date": end_date,
        "daily_totals": [
            {
                "date": row.work_date,
                "average_speed": (
                    round(float(row.average_speed), 2)
                    if row.average_speed is not None
                    else 0
                ),
            }
            for row in daily_totals
        ],
        "by_line": [
            {
                "date": row.work_date,
                "line_name": row.line_name,
                "average_speed": (
                    round(float(row.average_speed), 2)
                    if row.average_speed is not None
                    else 0
                ),
            }
            for row in line_totals
        ],
    }




@router.get("/reports/summary")
def get_dashboard_summary(
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db),
):
    if start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date cannot be after end_date",
        )

    result = (
        db.query(
            func.sum(Record.production).label("total_production"),
            func.sum(Record.energy).label("total_energy"),
            func.avg(Record.speed).label("average_speed"),
        )
        .join(
            DailyProduct,
            DailyProduct.daily_product_id == Record.daily_product_id,
        )
        .filter(
            DailyProduct.work_date >= start_date,
            DailyProduct.work_date <= end_date,
        )
        .first()
    )

    return {
        "start_date": start_date,
        "end_date": end_date,
        "total_production": result.total_production or 0,
        "total_energy": (
            round(float(result.total_energy), 3)
            if result.total_energy is not None
            else 0
        ),
        "average_speed": (
            round(float(result.average_speed), 2)
            if result.average_speed is not None
            else 0
        ),
    }







@router.get("/reports/shift-production-breakdown")
def get_shift_production_breakdown(
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db),
):
    if start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date cannot be after end_date",
        )

    results = (
        db.query(
            Line.name.label("line_name"),
            Product.name.label("product_name"),
            Shift.name.label("shift_name"),
            func.sum(Record.production).label("total_production"),
            func.sum(Record.energy).label("total_energy"),
        )
        .join(
            DailyProduct,
            DailyProduct.line_id == Line.line_id,
        )
        .join(
            Product,
            Product.product_id == DailyProduct.product_id,
        )
        .join(
            Record,
            Record.daily_product_id == DailyProduct.daily_product_id,
        )
        .join(
            Shift,
            Shift.shift_id == Record.shift_id,
        )
        .filter(
            DailyProduct.work_date >= start_date,
            DailyProduct.work_date <= end_date,
        )
        .group_by(
            Line.line_id,
            Line.name,
            Product.product_id,
            Product.name,
            Shift.shift_id,
            Shift.name,
        )
        .order_by(
            Line.line_id,
            Product.product_id,
            Shift.shift_id,
        )
        .all()
    )

    return {
        "start_date": start_date,
        "end_date": end_date,
        "items": [
            {
                "line_name": row.line_name,
                "product_name": row.product_name,
                "shift_name": row.shift_name,
                "total_production": row.total_production,
                "total_energy": (
                    round(float(row.total_energy), 3)
                    if row.total_energy is not None
                    else 0
                ),
            }
            for row in results
        ],
    }


