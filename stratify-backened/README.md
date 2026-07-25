# Stratify 2.0 — AI-Powered Client Lifecycle Automation Platform

> Automate client requirement analysis, proposal generation, project planning, and scope control — all without an external AI API.

---

## What is Stratify 2.0?

Stratify 2.0 is a **FastAPI backend** built for freelancers and software agencies to eliminate the manual overhead of client project management. From a raw client description, it automatically:

- Extracts and estimates features
- Generates a priced proposal
- Produces a sprint-by-sprint project plan
- Detects and prices out-of-scope requests

No ChatGPT. No API keys. Fully offline and self-contained.

---

## Features

| Module | Description |
|--------|-------------|
| **Requirement Analyzer** | Parses free-text client descriptions, identifies features, scores complexity (low → critical), and estimates timeline |
| **Proposal Generator** | Builds a professional proposal with itemized costs, complexity multiplier, and 15% contingency buffer |
| **Project Planner** | Creates a full task breakdown with dependencies, weekly sprint schedule, and milestones |
| **Scope Checker** | Compares new client requests against the original scope — flags scope creep and quotes the extra cost |

---

## Tech Stack

- **Framework** — [FastAPI](https://fastapi.tiangolo.com/)
- **Server** — Uvicorn (ASGI)
- **Database** — SQLite via SQLAlchemy ORM
- **Validation** — Pydantic v2
- **Config** — python-dotenv

---

## Project Structure

```
stratify2.0/
├── app/
│   ├── main.py              # FastAPI app entrypoint & router registration
│   ├── config.py            # Environment config (hourly rate, weekly hours, complexity weights)
│   ├── database.py          # SQLAlchemy engine & session setup
│   ├── models.py            # ORM models (Requirement, Proposal, Plan, ScopeCheck)
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── engine/
│   │   ├── requirement_analyzer.py   # Feature extraction & complexity scoring
│   │   ├── proposal_generator.py     # Cost estimation & proposal generation
│   │   ├── project_planner.py        # Task breakdown & sprint scheduling
│   │   └── scope_checker.py          # Scope creep detection
│   └── routes/
│       ├── health.py         # GET /health
│       ├── requirements.py   # POST /requirements
│       ├── proposals.py      # POST /proposals
│       ├── plans.py          # POST /plans
│       └── scope_check.py    # POST /scope-check
├── .env                     # Environment variables (not committed)
├── .gitignore
├── requirements.txt
└── README.md
```

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/riiyatomar/stratify-backened.git
cd stratify-backened
```

### 2. Create a virtual environment

```bash
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS / Linux
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

Create a `.env` file in the project root:

```env
DATABASE_URL=sqlite:///./stratify.db
HOURLY_RATE=150
WEEKLY_HOURS=40
```

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLAlchemy connection string | `sqlite:///./stratify.db` |
| `HOURLY_RATE` | Your billing rate ($/hr) used for cost estimates | `150` |
| `WEEKLY_HOURS` | Developer hours per week used for timeline calculation | `40` |

### 5. Run the server

```bash
uvicorn app.main:app --reload --port 8000
```

The API will be live at **http://127.0.0.1:8000**

---

## API Reference

### Base URL
```
http://127.0.0.1:8000
```

### Endpoints

#### `GET /health`
Returns server health status.

#### `POST /requirements`
Analyze a free-text client requirement.

```json
// Request
{
  "client_name": "Acme Corp",
  "description": "We need an e-commerce platform with payment integration, user authentication, and an admin dashboard."
}

// Response
{
  "id": 1,
  "features": [...],
  "complexity": "high",
  "complexity_score": 6.8,
  "timeline_estimate": "8-11 weeks"
}
```

#### `POST /proposals`
Generate a cost proposal from an analyzed requirement.

```json
// Request
{ "requirement_id": 1 }

// Response
{
  "project_summary": "...",
  "feature_list": [...],
  "cost_estimate": 24750.00,
  "timeline": "10-13 weeks"
}
```

#### `POST /plans`
Generate a detailed project plan from an analyzed requirement.

```json
// Request
{ "requirement_id": 1 }

// Response
{
  "task_breakdown": [...],
  "weekly_timeline": [...],
  "milestones": [...]
}
```

#### `POST /scope-check`
Check whether a new client request falls outside the original agreed scope.

```json
// Request
{
  "requirement_id": 1,
  "new_request": "Can you also add a real-time chat system and mobile app?"
}

// Response
{
  "is_extra_work": true,
  "explanation": "The new request introduces: Real-Time (~32 hrs), Mobile (~44 hrs)...",
  "additional_cost_estimate": 11400.00
}
```

---

## Interactive API Docs

Once the server is running, visit:

- **Swagger UI** → http://127.0.0.1:8000/docs
- **ReDoc** → http://127.0.0.1:8000/redoc

---

## How the Pricing Works

```
Base Cost     = Total Feature Hours × Hourly Rate
Adjusted Cost = Base Cost × Complexity Multiplier (1.0x – 1.6x)
Final Cost    = Adjusted Cost + 15% Contingency Buffer
```

**Complexity Multiplier** scales with the complexity score (0–10):
- Score 0–2.5 → `low` → 1.0x
- Score 2.5–5.0 → `medium` → ~1.15x
- Score 5.0–7.5 → `high` → ~1.45x
- Score 7.5–10 → `critical` → up to 1.6x

---

## Recognized Feature Categories

The analyzer can detect and estimate **22+ feature types** including:

`Authentication` · `Payment` · `Real-Time` · `AI/NLP` · `Machine Learning` · `Dashboard` · `Analytics` · `E-Commerce` · `Search` · `Chat/Messaging` · `File Upload` · `Notifications` · `API` · `Database` · `Security` · `Testing` · `Deployment` · `Monitoring` · `Mobile` · `Responsive Design` · `SEO` · `Integration`

---

## License

MIT License — feel free to use, modify, and distribute.

---

> Built with ❤️ to help developers stop underselling their work.
