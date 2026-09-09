#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_URL="http://localhost:8080"
IMAGE_NAME="mujin-assessment:latest"
CONTAINER_NAME="mujin-assessment"
HOST_PORT="8080"
BASE_IMAGE="debian:bullseye"

info() {
  printf '%s\n' "$1"
}

fail() {
  printf '\n%s\n' "$1" >&2
  if [[ $# -gt 1 ]]; then
    printf '%s\n' "$2" >&2
  fi
  exit 1
}

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    fail \
      "Docker is not installed." \
      "Install Docker Desktop, start it, then run this command again:
  https://docs.docker.com/get-docker/"
  fi

  if ! docker info >/dev/null 2>&1; then
    fail \
      "Docker is installed, but the Docker engine is not running." \
      "Open Docker Desktop and wait until it is running, then run this command again."
  fi
}

port_in_use() {
  local port="$1"

  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
    return
  fi

  return 1
}

remove_existing_container() {
  if docker container inspect "${CONTAINER_NAME}" >/dev/null 2>&1; then
    info "Removing the existing ${CONTAINER_NAME} container..."
    docker rm -f "${CONTAINER_NAME}" >/dev/null
  fi
}

require_ports() {
  if port_in_use "${HOST_PORT}"; then
    fail \
      "Port ${HOST_PORT} is already in use." \
      "Stop the other process, then run this command again.
  If a previous container is still up, stop it with:
  docker rm -f ${CONTAINER_NAME}"
  fi
}

ensure_image() {
  bash "${ROOT_DIR}/scripts/docker-build.sh"
}

scan_images() {
  if command -v trivy >/dev/null 2>&1; then
    info "Scanning local images with Trivy..."
    trivy image --scanners vuln "${IMAGE_NAME}" || true
    return
  fi

  if docker scout version >/dev/null 2>&1; then
    info "Scanning local images with Docker Scout..."
    docker scout cves "${IMAGE_NAME}" || true
    return
  fi

  if docker scan --help >/dev/null 2>&1; then
    info "Scanning local images with docker scan..."
    docker scan "${IMAGE_NAME}" || true
    return
  fi

  info "No local vulnerability scanner found. Install Trivy, then run:"
  info "  trivy image ${BASE_IMAGE}"
  info "  trivy image ${IMAGE_NAME}"
}

run_container() {
  docker run -d \
    --name "${CONTAINER_NAME}" \
    --restart unless-stopped \
    --read-only \
    --tmpfs /tmp \
    --cap-drop ALL \
    --security-opt no-new-privileges \
    --user 1001:1001 \
    -p "127.0.0.1:${HOST_PORT}:3000" \
    -e HOST=0.0.0.0 \
    -e PORT=3000 \
    -e MAPS_DIR=/tmp/data \
    -e STATIC_DIR=/app/public \
    "${IMAGE_NAME}"
}

wait_for_container() {
  local attempt=0
  local status=""

  while [[ "${attempt}" -lt 30 ]]; do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${CONTAINER_NAME}" 2>/dev/null || true)"

    if [[ "${status}" == "healthy" ]]; then
      return
    fi

    if [[ "${status}" == "unhealthy" || "${status}" == "exited" || "${status}" == "dead" ]]; then
      break
    fi

    attempt=$((attempt + 1))
    sleep 2
  done

  info ""
  info "The container started, but the health check did not pass in time."
  info "Recent logs:"
  docker logs --tail=40 "${CONTAINER_NAME}" || true
  fail "The container did not become healthy. See the logs above."
}

main() {
  cd "${ROOT_DIR}"

  info "Checking required software..."
  require_docker
  remove_existing_container
  require_ports

  info "Docker is ready."
  ensure_image
  scan_images

  info ""
  info "Starting the app on localhost only..."
  run_container
  wait_for_container

  info ""
  info "The app is running."
  info ""
  info "  App   ${APP_URL}"
  info "  API   ${APP_URL}/api/health"
  info ""
  info "Stop it with:"
  info "  docker rm -f ${CONTAINER_NAME}"
}

main "$@"
