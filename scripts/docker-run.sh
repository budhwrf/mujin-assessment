#!/usr/bin/env bash

set -euo pipefail

APP_URL="http://localhost:8080"
IMAGE_REPO="mujin-assessment"
IMAGE_TAG="latest"
DEFAULT_USERNAME="budhwrf"
CONTAINER_NAME="mujin-assessment"
HOST_PORT="8080"

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

resolve_username() {
  if [[ $# -gt 0 && -n "${1}" ]]; then
    printf '%s' "$1"
    return
  fi

  if [[ -n "${DOCKERHUB_USERNAME:-}" ]]; then
    printf '%s' "${DOCKERHUB_USERNAME}"
    return
  fi

  printf '%s' "${DEFAULT_USERNAME}"
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
  local username remote_image

  username="$(resolve_username "${1:-}")"
  remote_image="${username}/${IMAGE_REPO}:${IMAGE_TAG}"

  info "Checking Docker..."
  require_docker
  remove_existing_container
  require_ports

  info "Pulling ${remote_image}..."
  if ! docker pull "${remote_image}"; then
    fail \
      "Could not pull ${remote_image}." \
      "Check your network connection, then run this command again."
  fi

  info "Starting ${remote_image} on localhost only..."
  docker run -d \
    --name "${CONTAINER_NAME}" \
    --rm \
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
    "${remote_image}"

  wait_for_container

  info ""
  info "The published image is running."
  info ""
  info "  App   ${APP_URL}"
  info "  API   ${APP_URL}/api/health"
  info ""
  info "Stop it with:"
  info "  docker rm -f ${CONTAINER_NAME}"
}

main "$@"
