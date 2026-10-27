<div align="center">

# 🏭 Production Monitoring System

### A clear, data-driven view of production, energy consumption, and line performance.

Built with **FastAPI · SQLAlchemy · MySQL · HTML · CSS · JavaScript**

<br>

![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-REST%20API-009688?logo=fastapi&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-Database-4479A1?logo=mysql&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-ORM-D71F00?logo=sqlalchemy&logoColor=white)
![Status](https://img.shields.io/badge/Project-Assignment%20Implementation-2563EB)

</div>

---

## ✨ Overview

The **Production Monitoring System** is a web application for recording and analysing manufacturing performance across four production lines and three shifts.

Operators can enter shift-wise production data, while the dashboard and reporting pages help users review production output, energy consumption, and line-speed trends across selected dates.

The project demonstrates a complete, database-backed workflow: **operator input → API validation → MySQL storage → reports and visualisations**.

## 🎯 What the application covers

| Area | What you can do |
|---|---|
| 📊 **Dashboard** | Review daily and monthly KPIs, line performance, and production and energy trends. |
| 📝 **Production Entry** | Record the date, line, allowed product, shift, production quantity, line speed, and energy consumed. |
| 🗂️ **Production Records** | View saved entries and use available date, line, shift, and edit controls. |
| 📈 **Reports & Trends** | Analyse daily/monthly summaries, production trends, energy trends, line speed, shifts, and products. |
| ⚙️ **Master Data** | Maintain the line, product, shift, and allowed line–product reference data used by the application. |

## 🧭 Production rules

The application is designed around the assignment's production rules:

- **4 production lines:** Line 1, Line 2, Line 3, and Line 4.
- **3 shifts:** A, B, and C.
- **One selected product per line per day.**
- **Shift-wise records:** production, speed, and energy are recorded separately for each shift.
- **Allowed products are line-specific**, as shown below.
- **Non-negative measurements** are enforced through database constraints and application validation.

### Allowed line–product mapping

| Production line | Products it can manufacture |
|---|---|
| Line 1 | Product 1, Product 2, Product 3, Product 4 |
| Line 2 | Product 2, Product 4 |
| Line 3 | Product 1 |
| Line 4 | Product 1, Product 3, Product 5 |

## 🖥️ Pages

When the application is running locally, open these pages in your browser:

| Page | Local URL | Purpose |
|---|---|---|
| Dashboard | [`/dashboard`](http://127.0.0.1:8000/dashboard) | Daily/monthly KPIs and charts |
| Production Entry | [`/operator`](http://127.0.0.1:8000/operator) | Enter and review shift production data |
| Production Records | [`/records`](http://127.0.0.1:8000/records) | Browse saved production records |
| Reports & Trends | [`/reports`](http://127.0.0.1:8000/reports) | Explore date-range reports and comparisons |
| Swagger UI | [`/docs`](http://127.0.0.1:8000/docs) | Try the REST APIs interactively |
| ReDoc | [`/redoc`](http://127.0.0.1:8000/redoc) | Browse API reference documentation |
| Health check | [`/health`](http://127.0.0.1:8000/health) | Check that the API is responding |

> **Note:** These URLs are local development addresses. They work on the computer running the application, not as public hosted links.

## 🧰 Technology stack

| Technology | Role in the project |
|---|---|
| **Python** | Backend language |
| **FastAPI** | REST API and request handling |
| **SQLAlchemy ORM** | Database models and queries |
| **MySQL** | Relational data storage |
| **PyMySQL** | Python MySQL driver |
| **Pydantic Settings / python-dotenv** | Application configuration |
| **Jinja2** | Server-rendered HTML templates |
| **HTML, CSS, JavaScript** | User interface and browser-side interactions |
| **Chart.js** | Interactive dashboard charts, where included by the frontend |
| **Uvicorn** | Local ASGI development server |
| **Alembic** | Database migration tooling included in project dependencies |

## 🏗️ How it works

```text
┌────────────────────────────┐
│     Operator / Reviewer    │
└─────────────┬──────────────┘
              │ Browser
              ▼
┌────────────────────────────┐
│  HTML · CSS · JavaScript   │
│ Dashboard · Entry · Reports│
└─────────────┬──────────────┘
              │ HTTP / JSON
              ▼
┌────────────────────────────┐
│          FastAPI           │
│ Routers · Validation · API │
└─────────────┬──────────────┘
              │ SQLAlchemy ORM
              ▼
┌────────────────────────────┐
│           MySQL            │
│ Master data + shift records│
└────────────────────────────┘
```

## 🗃️ Database design

The database uses six main tables:

| Table | Responsibility |
|---|---|
| `line` | Stores the four production lines |
| `product` | Stores product master data |
| `shift` | Stores shifts A, B, and C |
| `line_product` | Stores valid line–product combinations |
| `daily_product` | Connects a production date and line with its selected product |
| `record` | Stores shift-wise speed, production, and energy values |

### Key relationships

- `line_product` maps products to production lines.
- `daily_product` references an allowed `(line_id, product_id)` pair.
- `record` references a `daily_product` and a `shift`.
- Database constraints prevent duplicate daily assignments for a line and duplicate records for the same daily product and shift.

## 📁 Project structure

This reflects the folder layout shown in the project workspace:

```text
Production-Monitoring-System/
├── .venv/                      # Local Python virtual environment (not committed)
├── backend/
│   ├── app/
│   │   ├── models/             # SQLAlchemy models
│   │   ├── routers/            # FastAPI route modules
│   │   ├── schemas/            # Request/response schemas
│   │   ├── services/           # Application/business logic
│   │   ├── static/
│   │   │   ├── css/            # Stylesheets
│   │   │   └── js/             # Frontend JavaScript
│   │   ├── templates/          # Jinja2 HTML templates
│   │   ├── __init__.py
│   │   ├── database.py         # Database connection and ORM base
│   │   ├── main.py             # FastAPI application entry point
│   │   └── seed.py             # Initial master-data seeding
│   ├── .env.example            # Configuration template (no real secrets)
│   ├── requirements.txt        # Python dependencies
│   └── .env                    # Local secrets; keep out of Git
├── .gitignore
└── README.md
```

> The `.env` file and virtual environment are local setup files. They should not be committed to a public repository.

---

## 🚀 Run locally (Windows)

Follow these steps to run the project on a new machine.

### 1. Prerequisites

Install the following:

- [Python](https://www.python.org/downloads/)
- [MySQL Server](https://dev.mysql.com/downloads/mysql/)
- [MySQL Workbench](https://dev.mysql.com/downloads/workbench/)
- [Git](https://git-scm.com/downloads)
- [Visual Studio Code](https://code.visualstudio.com/) (recommended)

Verify Python and Git are available:

```powershell
python --version
git --version
```

### 2. Clone the repository

```powershell
git clone https://github.com/Shivakantpandey7370/Production-Monitoring-System.git
cd Production-Monitoring-System
```

### 3. Create and activate a virtual environment

Run these commands from the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

If PowerShell blocks activation, use Command Prompt instead:

```bat
.venv\Scripts\activate.bat
```

### 4. Install dependencies

```powershell
python -m pip install --upgrade pip
pip install -r backend/requirements.txt
```

### 5. Create the MySQL database

Open MySQL Workbench and execute:

```sql
CREATE DATABASE production_monitoring;
```

Use the database name expected by your environment configuration. If you choose another name, use it consistently in the following step.

### 6. Configure environment variables

Copy the example file:

```powershell
Copy-Item backend/.env.example backend/.env
```

Open `backend/.env` and fill in the local MySQL connection details using the **variable names already present in `backend/.env.example`**. For example, the settings may include:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_local_mysql_password
DB_NAME=production_monitoring
```

The snippet above is illustrative. Keep the names and format expected by your `database.py` configuration.

**Security:** Never commit `backend/.env`, actual passwords, or other secrets. Only commit the credential-free `.env.example`.

### 7. Initialise tables and master data

Move into the backend folder:

```powershell
cd backend
```

Run the master-data seed script:

```powershell
python -m app.seed
```

The seed script inserts the four lines, five products, three shifts, and the allowed line–product mappings. The application creates its tables at startup if its configured `main.py` uses `Base.metadata.create_all(...)` and the model metadata has been imported.

### 8. Start the application

From the `backend` folder, with the virtual environment still active:

```powershell
python -m uvicorn app.main:app --reload
```

Keep the terminal open while using the application. Press `Ctrl + C` to stop the server.

Now open:

- Dashboard: http://127.0.0.1:8000/dashboard
- Production Entry: http://127.0.0.1:8000/operator
- Reports & Trends: http://127.0.0.1:8000/reports
- Swagger UI: http://127.0.0.1:8000/docs

---

## 🔌 API reference

FastAPI serves interactive API documentation at [`/docs`](http://127.0.0.1:8000/docs) when running locally.

### Master data

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/v1/lines` | List production lines |
| `GET` | `/api/v1/products` | List products |
| `GET` | `/api/v1/shifts` | List shifts |
| `GET` | `/api/v1/lines/{line_id}/products` | List products allowed for a line |

### Production records

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/v1/production-records` | Create a shift production record |
| `GET` | `/api/v1/production-records` | Retrieve production records |
| `PUT` | `/api/v1/production-records/{record_id}` | Update an existing record |

### Reports and analytics

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/v1/reports/daily` | Daily production, energy, line, shift, and product summaries |
| `GET` | `/api/v1/reports/monthly` | Monthly performance summary |
| `GET` | `/api/v1/reports/production-trend` | Daily production trends over a date range |
| `GET` | `/api/v1/reports/energy-trend` | Daily energy trends over a date range |
| `GET` | `/api/v1/reports/shift-comparison` | Compare shifts |
| `GET` | `/api/v1/reports/line-product-summary` | Summarise line-product performance |
| `GET` | `/api/v1/reports/line-speed-trend` | Review average speed by line and date |
| `GET` | `/api/v1/reports/summary` | Retrieve dashboard summary data |
| `GET` | `/api/v1/reports/shift-production-breakdown` | Retrieve shift-wise production breakdown |

Use `/docs` for current request parameters, request bodies, response examples, and validation requirements.

### Example request

The following is an illustrative request body for `POST /api/v1/production-records`. Confirm the required schema and use valid IDs from your own database before executing it.

```json
{
  "production_date": "2026-10-27",
  "line_id": 1,
  "product_id": 1,
  "shift_id": 1,
  "production_quantity": 500,
  "line_speed": 45,
  "energy_consumed": 100
}
```

## ✅ Validation and testing checklist

When testing a fresh setup, verify:

- [ ] The application starts and `/health` responds.
- [ ] Master-data APIs return the seeded lines, products, and shifts.
- [ ] Allowed product options change according to the selected line.
- [ ] A valid production record can be saved and retrieved.
- [ ] The same line cannot be assigned a different product on the same date.
- [ ] Duplicate records for the same daily product and shift are rejected.
- [ ] Negative production, speed, and energy values are rejected.
- [ ] Daily/monthly API totals match SQL queries against MySQL.
- [ ] Dashboard and report pages display the saved data.
- [ ] Data remains available after restarting the application.

## 🛠️ Troubleshooting

<details>
<summary><strong>MySQL connection fails</strong></summary>

- Confirm MySQL Server is running.
- Check host, port, username, password, and database name in `backend/.env`.
- Make sure the database exists.
- Review the backend terminal for SQLAlchemy connection errors.
</details>

<details>
<summary><strong>Tables or master data are missing</strong></summary>

- Start the app with the correct environment loaded.
- Check that the application's model metadata is imported before table creation.
- From the `backend` directory, run `python -m app.seed`.
- Refresh the schema in MySQL Workbench and check the table row counts.
</details>

<details>
<summary><strong>Python package or import errors</strong></summary>

- Activate the project's virtual environment.
- Install dependencies using `pip install -r backend/requirements.txt` from the repository root.
- If already inside `backend`, use `pip install -r requirements.txt`.
- Run Uvicorn from the `backend` directory with `python -m uvicorn app.main:app --reload`.
</details>

<details>
<summary><strong>Dashboard has no data</strong></summary>

- Confirm production records exist in the configured database.
- Select a date/month that contains records.
- Check the relevant report endpoint in Swagger.
- Review the browser console and backend terminal for errors.
</details>

<details>
<summary><strong>Port 8000 is already in use</strong></summary>

Run the server on another port:

```powershell
python -m uvicorn app.main:app --reload --port 8001
```

Then open the application using `http://127.0.0.1:8001`.
</details>

## 🔭 Possible next steps

Potential extensions include automated integration tests, authenticated operator accounts, deployment configuration, and downloadable reports. These are future improvements, not claims about the current implementation.

---

<div align="center">

### Built to make production data easier to record, understand, and act on.

**Author : Shivakant Pandey** · [GitHub Profile](https://github.com/Shivakantpandey7370) · [Project Repository](https://github.com/Shivakantpandey7370/Production-Monitoring-System)

</div>



