
from app.database import SessionLocal
from app.models import Line, Product, Shift, LineProduct


def seed_data():
    db = SessionLocal()

    try:
        # 1. Lines insert karo
        line_names = ["Line 1", "Line 2", "Line 3", "Line 4"]

        for name in line_names:
            line = db.query(Line).filter(Line.name == name).first()

            if line is None:
                db.add(Line(name=name))

        # 2. Products insert karo
        product_names = [
            "Product 1",
            "Product 2",
            "Product 3",
            "Product 4",
            "Product 5",
        ]

        for name in product_names:
            product = db.query(Product).filter(
                Product.name == name
            ).first()

            if product is None:
                db.add(Product(name=name))

        # 3. Shifts insert karo
        shift_names = ["A", "B", "C"]

        for name in shift_names:
            shift = db.query(Shift).filter(
                Shift.name == name
            ).first()

            if shift is None:
                db.add(Shift(name=name))

        # Lines, products aur shifts ke IDs save karna
        db.commit()

        # 4. Line-product mapping
        mapping = {
            "Line 1": [
                "Product 1",
                "Product 2",
                "Product 3",
                "Product 4",
            ],
            "Line 2": ["Product 2", "Product 4"],
            "Line 3": ["Product 1"],
            "Line 4": ["Product 1", "Product 3", "Product 5"],
        }

        for line_name, product_list in mapping.items():
            line = db.query(Line).filter(
                Line.name == line_name
            ).first()

            for product_name in product_list:
                product = db.query(Product).filter(
                    Product.name == product_name
                ).first()

                existing = db.query(LineProduct).filter(
                    LineProduct.line_id == line.line_id,
                    LineProduct.product_id == product.product_id,
                ).first()

                if existing is None:
                    db.add(
                        LineProduct(
                            line_id=line.line_id,
                            product_id=product.product_id,
                        )
                    )

        db.commit()

        print("Master data inserted successfully!")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
