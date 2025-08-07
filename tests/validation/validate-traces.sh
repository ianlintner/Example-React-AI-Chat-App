#!/bin/sh

set -e

ZIPKIN_URL=${ZIPKIN_URL:-"http://zipkin:9411"}
BACKEND_URL=${BACKEND_URL:-"http://backend:5001"}
MAX_RETRIES=30
RETRY_INTERVAL=10

echo "🔍 Starting trace validation..."
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
    curl -f -s "$BACKEND_URL/health" > /dev/null || echo "⚠️ Health check failed"
    
    # API health check
    curl -f -s "$BACKEND_URL/api/health" > /dev/null || echo "⚠️ API health check failed"
    
    # Metrics endpoint
    curl -f -s "$BACKEND_URL/metrics" > /dev/null || echo "⚠️ Metrics check failed"
    
    # Try some API endpoints
    curl -f -s "$BACKEND_URL/api/conversations" > /dev/null || echo "⚠️ Conversations API failed"
    curl -f -s "$BACKEND_URL/api/test-bench/agents" > /dev/null || echo "⚠️ Test bench API failed"
    curl -f -s "$BACKEND_URL/api/queue/status" > /dev/null || echo "⚠️ Queue API failed"
    
    echo "✅ Test traces generated"
}

# Function to query Zipkin for traces
validate_traces_in_zipkin() {
    echo "🔍 Validating traces in Zipkin..."
    
    # Wait a bit for traces to be processed
    echo "⏳ Waiting for traces to be processed..."
    sleep 30
    
    # Query Zipkin API for services
    local services_response
    services_response=$(curl -f -s "$ZIPKIN_URL/api/v2/services" | grep -o '"ai-goal-seeking-backend"' | head -1 || echo "")
    
    if [ -n "$services_response" ]; then
        echo "✅ Found ai-goal-seeking-backend service in Zipkin"
        
        # Query for traces
        local traces_response
        traces_response=$(curl -f -s "$ZIPKIN_URL/api/v2/traces?serviceName=ai-goal-seeking-backend&limit=10" | grep -o '"traceId"' | wc -l || echo "0")
        
        if [ "$traces_response" -gt 0 ]; then
            echo "✅ Found $traces_response traces for ai-goal-seeking-backend"
            return 0
        else
            echo "⚠️ No traces found for ai-goal-seeking-backend"
            return 1
        fi
    else
        echo "⚠️ ai-goal-seeking-backend service not found in Zipkin"
        return 1
    fi
}

# Main validation workflow
main() {
    # Wait for services
    wait_for_service "$ZIPKIN_URL/health" "Zipkin"
    wait_for_service "$BACKEND_URL/health" "Backend"
    
    # Generate test traces
    generate_test_traces
    
    # Validate traces in Zipkin
    if validate_traces_in_zipkin; then
        echo "🎉 Trace validation completed successfully!"
        exit 0
    else
        echo "❌ Trace validation failed - traces not found in Zipkin"
        echo "💡 Check OpenTelemetry configuration and Zipkin connectivity"
        
        # Print some debug info
        echo "🔧 Debug information:"
        echo "Services in Zipkin:"
        curl -f -s "$ZIPKIN_URL/api/v2/services" || echo "Failed to get services"
        
        exit 1
    fi
}

# Run main function
main "$@"
