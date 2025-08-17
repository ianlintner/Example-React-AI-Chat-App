import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc, { Options as SwaggerJSDocOptions } from 'swagger-jsdoc';
import path from 'path';
import fs from 'fs';
import type { OpenAPIV3 } from 'openapi-types';

/**
 * Resolve backend root for scanning TS files regardless of where the app is launched from.
 * - If process.cwd() is the backend directory, use it directly.
 * - If launched from repo root, use ./backend.
 */
function resolveBackendRoot(): string {
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, 'src'))) {
    // Likely running from backend directory
    return cwd;
  }
  if (fs.existsSync(path.join(cwd, 'backend', 'src'))) {
    // Likely running from repo root
    return path.join(cwd, 'backend');
  }
  // Fallback: walk up from compiled dir (dist/.../routes)
  return path.resolve(__dirname, '../../../../..', 'backend');
}

/**
 * Create OpenAPI spec using swagger-jsdoc by scanning JSDoc blocks across route files.
 * This follows the minimal-refactor approach: annotate existing route handlers and index health endpoints.
 */
export function createSwaggerSpec(): OpenAPIV3.Document {
  const backendRoot = resolveBackendRoot();

  const options: SwaggerJSDocOptions = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'AI Chat App API',
        version: '1.0.0',
        description:
          'Code-generated OpenAPI docs from JSDoc annotations using swagger-jsdoc + swagger-ui-express.',
      },
      servers: [
        {
          url: process.env.API_BASE_URL || 'http://localhost:5001',
          description: 'Local development',
        },
      ],
      tags: [
        { name: 'chat', description: 'Chat endpoints' },
        { name: 'conversations', description: 'Conversation management' },
        { name: 'reactions', description: 'Reactions endpoints' },
        { name: 'validation', description: 'Validation and quality' },
        { name: 'test-bench', description: 'Agent test bench' },
        { name: 'queue', description: 'Message queue operations' },
        { name: 'health', description: 'Health checks' },
      ],
      components: {
        schemas: {
          Message: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              content: { type: 'string' },
              role: { type: 'string', enum: ['user', 'assistant'] },
              timestamp: { type: 'string', format: 'date-time' },
              conversationId: { type: 'string', format: 'uuid' },
              agentUsed: { type: 'string', nullable: true },
              confidence: { type: 'number', nullable: true },
            },
            required: ['id', 'content', 'role', 'timestamp', 'conversationId'],
          },
          Conversation: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              title: { type: 'string' },
              messages: {
                type: 'array',
                items: { $ref: '#/components/schemas/Message' },
              },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
            required: ['id', 'title', 'messages', 'createdAt', 'updatedAt'],
          },
          ChatRequest: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              conversationId: {
                type: 'string',
                format: 'uuid',
                nullable: true,
              },
              forceAgent: { type: 'string', nullable: true },
            },
            required: ['message'],
          },
          ChatResponse: {
            type: 'object',
            properties: {
              message: { $ref: '#/components/schemas/Message' },
              conversation: { $ref: '#/components/schemas/Conversation' },
              agentUsed: { type: 'string', nullable: true },
              confidence: { type: 'number', nullable: true },
            },
            required: ['message', 'conversation'],
          },
        },
      }
    },
    // Scan TypeScript sources so we can keep annotations next to code.
    apis: [
      path.join(backendRoot, 'src', 'routes', '*.ts'),
      path.join(backendRoot, 'src', 'index.ts'),
    ],
  };

  // Generate spec
  const spec = swaggerJSDoc(options) as OpenAPIV3.Document;

  // Ensure minimal keys exist to avoid consumers failing on missing props
  spec.openapi = spec.openapi || '3.0.0';
  spec.paths = spec.paths || {};

  return spec;
}

/**
 * Register Swagger UI and JSON endpoints on the provided Express app.
 * - UI at /docs
 * - JSON at /docs/json
 */
export function registerSwaggerRoutes(
  app: Express,
  spec: OpenAPIV3.Document,
  options?: { uiPath?: string; jsonPath?: string },
): void {
  const uiPath = options?.uiPath ?? '/docs';
  const jsonPath = options?.jsonPath ?? '/docs/json';

  const uiOptions = {
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info { margin: 20px 0; }
      .swagger-ui .scheme-container { background: #fafafa; padding: 20px; border-radius: 4px; }
    `,
    customSiteTitle: 'API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'list',
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      tryItOutEnabled: true,
    },
  };

  // Serve UI and JSON endpoints
  app.use(uiPath, swaggerUi.serve, swaggerUi.setup(spec, uiOptions as any));
  app.get(jsonPath, (_req, res) => res.json(spec));
}
