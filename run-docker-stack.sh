#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
PROFILE=""
DETACHED=false
CLEAN=false
VALIDATE=false
LOAD_TEST=false

print_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -d, --detached    Run in detached mode"
    echo "  -c, --clean       Clean up volumes and containers before starting"
    echo "  -t, --test        Run with test profile (includes test runner)"
    echo "  -l, --load-test   Run load testing"
    echo "  -v, --validate    Run trace validation"
    echo "  -h, --help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                Start the full stack"
    echo "  $0 -d             Start in detached mode"
    echo "  $0 -c             Clean and start fresh"
    echo "  $0 -t             Start with test runner"
    echo "  $0 -l             Run load tests"
    echo "  $0 -v             Validate traces"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--detached)
            DETACHED=true
            shift
            ;;
        -c|--clean)
            CLEAN=true
            shift
            ;;
        -t|--test)
            PROFILE="--profile test"
            shift
            ;;
        -l|--load-test)
            LOAD_TEST=true
            shift
            ;;
        -v|--validate)
            VALIDATE=true
            shift
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            echo "Unknown option $1"
            print_usage
            exit 1
            ;;
    esac
done

echo -e "${BLUE}🚀 AI Goal-Seeking System - Docker Stack Runner${NC}"
echo -e "${BLUE}=================================================${NC}"

# Clean up if requested
if [ "$CLEAN" = true ]; then
    echo -e "${YELLOW}🧹 Cleaning up existing containers and volumes...${NC}"
    docker-compose -f docker-compose.yml -f docker-compose.test.yml down -v --remove-orphans || true
    docker system prune -f || true
    echo -e "${GREEN}✅ Cleanup completed${NC}"
fi

# Build images
echo -e "${BLUE}🏗️ Building Docker images...${NC}"
docker-compose -f docker-compose.yml -f docker-compose.test.yml build

# Start services
DOCKER_COMPOSE_CMD="docker-compose -f docker-compose.yml -f docker-compose.test.yml"
if [ "$DETACHED" = true ]; then
    DOCKER_COMPOSE_CMD="$DOCKER_COMPOSE_CMD up -d $PROFILE"
else
    DOCKER_COMPOSE_CMD="$DOCKER_COMPOSE_CMD up $PROFILE"
fi

echo -e "${BLUE}🚀 Starting services...${NC}"
echo -e "${YELLOW}Command: $DOCKER_COMPOSE_CMD${NC}"

if [ "$DETACHED" = true ]; then
    eval $DOCKER_COMPOSE_CMD
    
    echo -e "${GREEN}✅ Services started in detached mode${NC}"
    echo -e "${BLUE}📊 Service URLs:${NC}"
    echo -e "  🌐 Frontend:    http://localhost:8080"
    echo -e "  🔧 Backend:     http://localhost:5001"
    echo -e "  📈 Grafana:     http://localhost:3000 (admin/admin)"
    echo -e "  🔍 Jaeger UI:   http://localhost:16686"
    echo -e "  📊 Prometheus:  http://localhost:9090"
    echo -e "  💾 Redis:       redis://localhost:6379"
    
    # Wait for services to be healthy
    echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
    sleep 30
    
    # Run load test if requested
    if [ "$LOAD_TEST" = true ]; then
        echo -e "${BLUE}🏋️ Running load tests...${NC}"
        docker-compose -f docker-compose.yml -f docker-compose.test.yml run --rm load-test
    fi
    
    # Run trace validation if requested
    if [ "$VALIDATE" = true ]; then
        echo -e "${BLUE}🔍 Running trace validation...${NC}"
        docker-compose -f docker-compose.yml -f docker-compose.test.yml run --rm trace-validator
    fi
    
    echo -e "${GREEN}🎉 Stack is ready!${NC}"
    echo -e "${YELLOW}💡 To view logs: docker-compose -f docker-compose.yml -f docker-compose.test.yml logs -f${NC}"
    echo -e "${YELLOW}💡 To stop: docker-compose -f docker-compose.yml -f docker-compose.test.yml down${NC}"
else
    eval $DOCKER_COMPOSE_CMD
fi
