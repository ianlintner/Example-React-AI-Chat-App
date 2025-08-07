// Simple script to test tracing without running the full server
const path = require('path');

// Set up environment
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('🔍 Testing OpenTelemetry tracing setup...');
console.log('Environment:', {
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  ZIPKIN_ENDPOINT: process.env.ZIPKIN_ENDPOINT,
  OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME,
  ENABLE_TRACING: process.env.ENABLE_TRACING
});

// Import and run test traces
require('./dist/backend/src/tracing/testTraces');
