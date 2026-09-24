# Northstar Technical Architecture

## 1. Architecture Overview

Northstar is a multi-tenant Management Intelligence & Strategy Execution Platform.

The architecture is designed around four major layers:

1. User interface
2. Application and business logic
3. Data and authentication
4. Management intelligence

Northstar should remain useful even without AI.

Core calculations, permissions, project health, KPI status, and risk logic should be deterministic application logic. AI is used primarily to interpret structured information and produce management-oriented analysis.

---

## 2. Architecture Principles

Northstar will be designed according to the following principles:

- Multi-tenant from the beginning
- Secure by default
- Clear separation between frontend, backend, data, and AI
- Business logic should not depend entirely on AI models
- Modular architecture
- Testable components
- Maintainable code
- SaaS-ready without unnecessary enterprise complexity
- Provider-independent AI integration
- Least-privilege access to organizational data

---

## 3. High-Level Architecture

```mermaid
flowchart TD

    U[User Browser]

    U --> WEB[Next.js Web Application]

    WEB --> AUTH[Supabase Authentication]
    WEB --> API[FastAPI Backend]

    API --> DB[(PostgreSQL / Supabase)]
    API --> ENGINE[Northstar Business Logic]

    ENGINE --> PROJECT[Project Health Engine]
    ENGINE --> KPI[KPI Engine]
    ENGINE --> RISK[Risk Engine]
    ENGINE --> STRATEGY[Strategy Engine]

    ENGINE --> AI[AI Service Layer]

    AI --> OPENAI[OpenAI]
    AI --> ANTHROPIC[Anthropic]

    DB --> RLS[Row Level Security]s