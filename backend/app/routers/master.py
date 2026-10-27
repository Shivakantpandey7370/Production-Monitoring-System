
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Line, Product, Shift, LineProduct

router = APIRouter(
    prefix="/api/v1",
    tags=["Master Data"],
)


@router.get("/lines")
def get_lines(db: Session = Depends(get_db)):
    lines = db.query(Line).order_by(Line.line_id).all()

    return [
        {"line_id": line.line_id, "name": line.name}
        for line in lines
    ]


@router.get("/products")
def get_products(db: Session = Depends(get_db)):
    products = db.query(Product).order_by(Product.product_id).all()

    return [
        {"product_id": product.product_id, "name": product.name}
        for product in products
    ]


@router.get("/shifts")
def get_shifts(db: Session = Depends(get_db)):
    shifts = db.query(Shift).order_by(Shift.shift_id).all()

    return [
        {"shift_id": shift.shift_id, "name": shift.name}
        for shift in shifts
    ]


@router.get("/lines/{line_id}/products")
def get_line_products(
    line_id: int,
    db: Session = Depends(get_db),
):
    line = db.query(Line).filter(
        Line.line_id == line_id
    ).first()

    if line is None:
        raise HTTPException(
            status_code=404,
            detail="Line not found",
        )

    products = (
        db.query(Product)
        .join(
            LineProduct,
            Product.product_id == LineProduct.product_id,
        )
        .filter(LineProduct.line_id == line_id)
        .order_by(Product.product_id)
        .all()
    )

    return [
        {"product_id": product.product_id, "name": product.name}
        for product in products
    ]
