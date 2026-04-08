# Intelli - A Fidelis Platform

Welcome to the **Intelli** repository, an AI-powered enterprise application universe built by Fidelis. This repository contains the full monorepo representing both the modern Next.js frontend and the FastAPI backend.

## 🚀 Overview

**Intelli** provides a cutting-edge interface—including a Cinematic Solar Interface using WebGL/Three.js—coupled with a robust, AI-native Python backend. The backend incorporates state-of-the-art LLM pipelines (LangChain, LangGraph), vector spaces (Pinecone), and asynchronous task queues (Celery, Redis) to handle heavy document processing and AI inferences efficiently.

## 🛠 Tech Stack

The architecture separates the frontend client from the AI-powered backend, coordinating auxiliary services through Docker Compose.

### Frontend
- **Framework:** [Next.js 14](https://nextjs.org/) (React 18)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) & [Framer Motion](https://www.framer.com/motion/) for micro-interactions
- **3D / Visualization:** [Three.js](https://threejs.org/) (WebGL) for the Cinematic Solar Interface
- **State Management:** [Zustand](https://github.com/pmndrs/zustand) & [React Query](https://tanstack.com/query/latest)
- **Tooling:** Vite, ESLint, TypeScript

### Backend
- **Framework:** [FastAPI](https://fastapi.tiangolo.com/) (Python) running on Uvicorn
- **Database ORM:** [SQLAlchemy (asyncio)](https://www.sqlalchemy.org/) & Alembic for migrations
- **AI / LLM pipeline:** [LangChain](https://python.langchain.com/), [LangGraph](https://langchain-ai.github.io/langgraph/), Transformers
- **Vector Database:** [Pinecone](https://www.pinecone.io/)
- **Search:** [ElasticSearch](https://www.elastic.co/)
- **Task Queues & Messaging:** [Celery](https://docs.celeryq.dev/en/stable/) & [RabbitMQ (aio-pika)](https://github.com/mosquito/aio-pika)
- **Document Processing:** Spacy, PyMuPDF, pdfplumber, python-docx, openpyxl

### Infrastructure & Services
- **Containers:** [Docker & Docker Compose](https://www.docker.com/)
- **Relational DB:** PostgreSQL 15 (Alpine)
- **Cache / Broker:** Redis 7 (Alpine)
- **Object Storage:** [MinIO](https://min.io/) (S3-compatible)

---

## 🏗 Getting Started

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- [Node.js](https://nodejs.org/) (v18+) & `npm`
- [Python 3.10+](https://www.python.org/downloads/) (for local backend development)

### Running with Docker Compose
The easiest way to spin up the entire application stack (Frontend, Backend, Postgres, Redis, MinIO) is through Docker Compose.

1. Clone the repository and navigate to the root directory.
2. Initialize environment variables (use `.env.example` to create `.env` in the root and in the backend directory).
3. Run the following command:
   ```bash
   docker-compose up --build
   ```

### Local Development

#### Frontend
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Access the frontend interface at [http://localhost:3000](http://localhost:3000).

#### Backend
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create and activate a Virtual Environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the Uvicorn dev server:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

## 📁 Repository Structure

```
Intelli/
├── backend/            # FastAPI application, AI pipelines, tasks, tests
├── frontend/           # Next.js web application, 3D scenes, UI components
├── docs/               # Architecture diagrams and technical documentation
├── docker-compose.yml  # Local infrastructure orchestration
└── requirements.txt    # Global requirements
```

## 📜 License

proprietary and confidential. Property of Fidelis.
