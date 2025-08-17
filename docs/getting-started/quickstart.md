# Quickstart

10-minute TL;DR to run the demo and explore the architecture.

- Audience: New contributors, reviewers, and demo participants
- Prerequisites: Docker or Node 18+, Yarn/NPM, Git

## 1) Run the stack (fast path)

- Using Docker: see root docker-compose.yml
- Local dev: run backend and frontend independently

Example:

- Backend: `cd backend && npm install && npm run dev`
- Frontend (Expo): `cd frontend && npm install && npm start`

## 2) Verify health

- API docs at runtime: http://localhost:3000/docs
- OpenAPI JSON: http://localhost:3000/docs/json
- Frontend dev menu: Expo Dev Tools in browser

## 3) Next steps

- Setup details: [Setup](./setup.md)
- Common issues: [Troubleshooting](./troubleshooting.md)
- Explore the system: [System Overview](../architecture/system-overview.md)

---

<!-- Sources to merge (from plan):
- README.md (root)
- SETUP-INSTRUCTIONS.md (root)
- docs/reference/docker-setup.md
- docs/development.md
-->
