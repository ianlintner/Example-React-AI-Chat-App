# Setup and Configuration

Authoritative setup guide for local development and demo environments.

## Requirements

- Node 18+ and npm (or yarn)
- Docker (optional but recommended)
- Git
- macOS/Linux/Windows

## Project bootstrap

- Install deps:
  - `npm install` in `backend/` and `frontend/`
- Environment:
  - Copy `.env.example` to `.env` where applicable
- Docker:
  - Use `docker-compose.yml` to run infra/services if needed

## Additional references

- Docker setup: [reference/docker-setup.md](../reference/docker-setup.md)
- Code quality & tools: [reference/code-quality.md](../reference/code-quality.md)

---

<!-- Sources to merge (from plan):
- README.md (root)
- SETUP-INSTRUCTIONS.md (root) (will be removed after merge)
- docs/reference/docker-setup.md
- docs/development.md
-->
