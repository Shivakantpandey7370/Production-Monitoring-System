
from fastapi import FastAPI
from app.database import Base, engine
from app import models
from app.routers.master import router as master_router
from app.routers.production import router as production_router

from pathlib import Path
from fastapi import Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

app = FastAPI(
    title="Production Monitoring API",
    description="Production monitoring assignment backend",
    version="0.1.0",
)

BASE_DIR = Path(__file__).resolve().parent

app.mount(
    "/static",
    StaticFiles(directory=BASE_DIR / "static"),
    name="static",
)

templates = Jinja2Templates(
    directory=BASE_DIR / "templates"
)

Base.metadata.create_all(bind=engine)

app.include_router(master_router)
app.include_router(production_router)

@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/dashboard", include_in_schema=False)
def dashboard(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="dashboard.html",
        context={"active_page": "dashboard"},
    )


@app.get("/operator", include_in_schema=False)
def operator_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="operator.html",
        context={"active_page": "entry"},
    ) 


@app.get("/records", include_in_schema=False)
def records_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="records.html",
        context={"active_page": "records"},
    )


@app.get("/reports", include_in_schema=False)
def reports_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="reports.html",
        context={"active_page": "reports"},
    )


@app.get("/master-data", include_in_schema=False)
def master_data_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="master_data.html",
        context={"active_page": "master-data"},
    )
