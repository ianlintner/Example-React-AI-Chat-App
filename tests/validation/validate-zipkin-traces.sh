#!/bin/bash

set -e

ZIPKIN_URL=${ZIPKIN_URL:-"http://localhost:9411"}
BACKEND_URL=${BACKEND_URL:-"http://localhost:5001"}
MAX_RETRIES=30
RETRY_INTERVAL=10

echo "🔍 Starting Zipkin trace validation..."
echo "Zipkin UI: $ZIPKIN_URL"
echo "Backend API: $BACKEND_URL"

# Wait for services to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local retries=0
    
    echo "⏳ Waiting for $service_name to be ready..."
    
    while [ $retries -lt $MAX_RETRIES ]; do
        if curl -f -s "$url" >/dev/null 2>&1; then
            echo "✅ $service_name is ready"
            return 0
        fi
        
        retries=$((retries + 1))
        echo "⏳ $service_name not ready, retry $retries/$MAX_RETRIES in ${RETRY_INTERVAL}s..."
        sleep $RETRY_INTERVAL
    done
    
    echo "❌ $service_name failed to become ready after $MAX_RETRIES retries"
    return 1
}

# Function to make API calls and generate traces
generate_test_traces() {
    echo "🚀 Generating test traces..."
    
    # Health check
    echo "  - Testing health endpoint..."
    curl -f -s "$BACKEND_URL/health" > /dev/null && echo "    ✅ Health check passed" || echo "    ⚠️ Health check failed"
    
    # API health check
    echo "  - Testing API health endpoint..."
    curl -f -s "$BACKEND_URL/api/health" > /dev/null && echo "    ✅ API health check passed" || echo "    ⚠️ API health check failed"
    
    # Try some API endpoints
    echo "  - Testing conversations endpoint..."
    curl -f -s "$BACKEND_URL/api/conversations" > /dev/null && echo "    ✅ Conversations API passed" || echo "    ⚠️ Conversations API failed"
    
    echo "  - Testing queue status endpoint..."
    curl -f -s "$BACKEND_URL/api/queue/status" > /dev/null && echo "    ✅ Queue API passed" || echo "    ⚠️ Queue API failed"
    
    echo "✅ Test traces generated"
}

# Function to query Zipkin for traces
validate_traces_in_zipkin() {
    echo "🔍 Validating traces in Zipkin..."
    
    # Wait a bit for traces to be processed
    echo "⏳ Waiting for traces to be processed..."
    sleep 15
    
    # Query Zipkin API for services
    echo "  - Querying Zipkin for services..."
    local services_response
    services_response=$(curl -f -s "$ZIPKIN_URL/api/v2/services" 2>/dev/null || echo "[]")
    
    if echo "$services_response" | grep -q "ai-goal-seeking-backend"; then
        echo "    ✅ Found ai-goal-seeking-backend service in Zipkin"
        
        # Query for traces
        echo "  - Querying for traces..."
        local traces_response
        traces_response=$(curl -f -s "$ZIPKIN_URL/api/v2/traces?serviceName=ai-goal-seeking-backend&limit=10" 2>/dev/null || echo "[]")
        
        local trace_count
        trace_count=$(echo "$traces_response" | grep -o '"traceId"' | wc -l || echo "0")
        trace_count=$(echo "$trace_count" | tr -d ' ')
        
        if [ "$trace_count" -gt 0 ]; then
            echo "    ✅ Found $trace_count traces for ai-goal-seeking-backend"
            return 0
        else
            echo "    ⚠️ No traces found for ai-goal-seeking-backend"
            return 1
        fi
    else
        echo "    ⚠️ ai-goal-seeking-backend service not found in Zipkin"
        echo "    📋 Available services: $services_response"
        return 1
    fi
}

# Function to check OpenTelemetry Collector
check_otel_collector() {
    echo "🔧 Checking OpenTelemetry Collector..."
    
    local otel_health_url="http://localhost:13133"
    if curl -f -s "$otel_health_url" >/dev/null 2>&1; then
        echo "    ✅ OpenTelemetry Collector is healthy"
        return 0
    else
        echo "    ⚠️ OpenTelemetry Collector health check failed"
        return 1
    fi
}

# Main validation workflow
main() {
    # Check OpenTelemetry Collector first
    check_otel_collector
    
    # Wait for services
    wait_for_service "$ZIPKIN_URL/health" "Zipkin"
    wait_for_service "$BACKEND_URL/health" "Backend"
    
    # Generate test traces
    generate_test_traces
    
    # Validate traces in Zipkin
    if validate_traces_in_zipkin; then
        echo ""
        echo "🎉 SUCCESS: Zipkin trace validation completed successfully!"
        echo "📊 You can view traces at: $ZIPKIN_URL"
        exit 0
    else
        echo ""
        echo "❌ FAILED: Trace validation failed - traces not found in Zipkin"
        echo "💡 Troubleshooting tips:"
        echo "   - Check if OpenTelemetry is properly initialized in the backend"
        echo "   - Verify OTEL_EXPORTER_OTLP_ENDPOINT is set correctly"
        echo "   - Check OpenTelemetry Collector logs for errors"
        echo "   - Ensure the backend is generating spans"
        
        # Print some debug info
        echo ""
        echo "🔧 Debug information:"
        echo "Services in Zipkin:"
        curl -f -s "$ZIPKIN_URL/api/v2/services" 2>/dev/null || echo "Failed to get services"
        
        exit 1
    fi
}

# Run main function
main "$@"
