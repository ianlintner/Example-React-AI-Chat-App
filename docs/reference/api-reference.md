# API Reference

This project generates API documentation directly from code using swagger-jsdoc + swagger-ui-express. Use the live endpoints while the backend is running:

- Interactive Swagger UI: `http://localhost:5001/docs`
- OpenAPI JSON: `http://localhost:5001/docs/json`

Notes:

- The spec is built from JSDoc annotations in `backend/src/routes/**/*.ts` and `backend/src/index.ts`.
- Health checks are exposed at `/health` and `/api/health`.
- Core tags include: chat, conversations, reactions, validation, test-bench, queue, health.

If you need a static artifact, you can save the JSON from `/docs/json` and distribute it, or convert it to YAML with your preferred tooling.
