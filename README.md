# CipherVault

CipherVault is a microservices-based application. The backend is built with Python (FastAPI/uvicorn) and the frontend is built with Next.js (React).

## Prerequisites

- **Python 3.8+**
- **Node.js 18+** & **npm**

## Running the Backend

The backend consists of several microservices (API Gateway, Auth Service, Document Service, Encryption Service, Storage Service, and Audit Service) located in the `services/` directory.

1. **Activate the Virtual Environment** (Recommended)
   A `.venv` folder is already present in the root directory. You can activate it by running:
   - On Windows: `.\.venv\Scripts\activate`

2. **Start the Backend Services**
   You can easily spin up all the backend services at once using the provided python runner:
   ```bash
   python run_local.py
   ```
   This will start:
   - API Gateway (`http://localhost:8000`)
   - Auth Service (`http://localhost:8001`)
   - Document Service (`http://localhost:8002`)
   - Encryption Service (`http://localhost:8003`)
   - Storage Service (`http://localhost:8004`)
   - Audit Service (`http://localhost:8005`)


## Running the Frontend

The frontend is a Next.js application located in the `frontend/` directory.

1. **Navigate to the frontend folder:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

## Environment Configuration

The backend services rely on environment variables. 
- You can copy the contents of `.env.example` into a new `.env` file in the project root if you need to override the default configurations.
- The Next.js frontend also has a `.env.local` file inside the `frontend/` directory for its own specific configurations.
