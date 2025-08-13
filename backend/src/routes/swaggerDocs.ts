import express from 'express';
import swaggerUi from 'swagger-ui-express';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Load OpenAPI spec
const loadOpenApiSpec = () => {
  try {
    // When compiled, files are in backend/dist/backend/src/routes/
    // Need to go up to project root: ../../../../docs/test-bench-openapi.yaml
    const specPath = path.join(
      __dirname,
      '../../../../docs/test-bench-openapi.yaml',
    );
    const fileContents = fs.readFileSync(specPath, 'utf8');
    return yaml.load(fileContents) as object;
  } catch (error) {
    console.error('Error loading OpenAPI spec:', error);
    return {
      openapi: '3.0.3',
      info: {
        title: 'AI Chat App Test Bench API',
        description: 'OpenAPI specification could not be loaded',
        version: '1.0.0',
      },
      paths: {},
    };
  }
};

const swaggerSpec = loadOpenApiSpec();

// Swagger UI options
const swaggerOptions = {
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .scheme-container { background: #fafafa; padding: 20px; border-radius: 4px; }
  `,
  customSiteTitle: 'Test Bench API Documentation',
  customfavIcon: '/favicon.ico',
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

// Serve Swagger UI
router.use('/api-docs', swaggerUi.serve);
router.get('/api-docs', swaggerUi.setup(swaggerSpec, swaggerOptions));

// Serve raw OpenAPI spec as JSON
router.get('/openapi.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(swaggerSpec);
});

// Serve raw OpenAPI spec as YAML
router.get('/openapi.yaml', (req, res) => {
  try {
    const specPath = path.join(
      __dirname,
      '../../../../docs/test-bench-openapi.yaml',
    );
    const fileContents = fs.readFileSync(specPath, 'utf8');
    res.setHeader('Content-Type', 'text/yaml');
    res.send(fileContents);
  } catch (error) {
    res.status(500).json({ error: 'Could not load OpenAPI YAML file' });
  }
});

// API documentation landing page
router.get('/', (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Test Bench API Documentation</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background: #f8f9fa;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
          color: #2c3e50;
          border-bottom: 3px solid #3498db;
          padding-bottom: 10px;
        }
        .btn {
          display: inline-block;
          padding: 12px 24px;
          margin: 8px;
          background: #3498db;
          color: white;
          text-decoration: none;
          border-radius: 4px;
          transition: background 0.3s;
        }
        .btn:hover {
          background: #2980b9;
        }
        .btn-secondary {
          background: #95a5a6;
        }
        .btn-secondary:hover {
          background: #7f8c8d;
        }
        .features {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin: 30px 0;
        }
        .feature {
          padding: 20px;
          background: #f8f9fa;
          border-radius: 4px;
          border-left: 4px solid #3498db;
        }
        .feature h3 {
          margin-top: 0;
          color: #2c3e50;
        }
        .endpoint-count {
          font-size: 2em;
          font-weight: bold;
          color: #3498db;
          text-align: center;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🧪 Test Bench API Documentation</h1>
        
        <p>Welcome to the comprehensive API documentation for the AI Chat App Test Bench system. This API provides endpoints to test all agents, system components, and features.</p>
        
        <div class="endpoint-count">11 Test Endpoints Available</div>
        
        <div class="features">
          <div class="feature">
            <h3>🤖 Agent Testing</h3>
            <p>Test individual agents or run bulk tests across all 14 agent types including support, entertainment, and utility agents.</p>
          </div>
          
          <div class="feature">
            <h3>🔧 System Components</h3>
            <p>Test core system components like message classification, RAG service, and response validation.</p>
          </div>
          
          <div class="feature">
            <h3>🧠 Learning Systems</h3>
            <p>Test adaptive learning systems including joke learning, goal-seeking, and conversation management.</p>
          </div>
          
          <div class="feature">
            <h3>💚 System Health</h3>
            <p>Monitor system health, check component status, and browse available agent directory.</p>
          </div>
        </div>
        
        <div style="text-align: center; margin: 40px 0;">
          <a href="/docs/api-docs" class="btn">📖 Interactive API Documentation</a>
          <a href="/docs/openapi.json" class="btn btn-secondary">📄 OpenAPI JSON</a>
          <a href="/docs/openapi.yaml" class="btn btn-secondary">📄 OpenAPI YAML</a>
        </div>
        
        <h2>Quick Start Examples</h2>
        
        <h3>Test a Joke Agent</h3>
        <pre><code>curl -X POST http://localhost:5001/api/test-bench/agent/joke/test \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Tell me a funny joke!", "userId": "test-user"}'</code></pre>
        
        <h3>Check System Health</h3>
        <pre><code>curl http://localhost:5001/api/test-bench/health</code></pre>
        
        <h3>Test Message Classification</h3>
        <pre><code>curl -X POST http://localhost:5001/api/test-bench/classifier/test \\
  -H "Content-Type: application/json" \\
  -d '{"message": "I need billing support"}'</code></pre>
        
        <h2>Available Agent Types</h2>
        <ul>
          <li><strong>Support Agents:</strong> account_support, billing_support, website_support, operator_support</li>
          <li><strong>Entertainment Agents:</strong> joke, story_teller, riddle_master, quote_master, game_host, music_guru</li>
          <li><strong>Utility Agents:</strong> general, trivia, gif, hold_agent</li>
        </ul>
        
        <p><em>For complete documentation, examples, and interactive testing, visit the <a href="/docs/api-docs">Interactive API Documentation</a>.</em></p>
      </div>
    </body>
    </html>
  `;

  res.send(html);
});

export default router;
