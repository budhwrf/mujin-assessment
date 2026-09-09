#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_NAME="mujin-assessment:latest"
BASE_IMAGE="debian:bullseye"
LOCAL_BASE_IMAGE="debian-bullseye:local"

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

main() {
  cd "${ROOT_DIR}"

  info "Checking Docker..."
  require_docker

  info "Pulling ${BASE_IMAGE}..."
  if ! docker pull "${BASE_IMAGE}"; then
    fail \
      "Could not pull ${BASE_IMAGE}." \
      "Check your network connection, then run this command again."
  fi

  docker tag "${BASE_IMAGE}" "${LOCAL_BASE_IMAGE}"

  info "Building ${IMAGE_NAME} from the Dockerfile..."
  info "This can take a few minutes."
  info ""

  if ! docker build \
    --file "${ROOT_DIR}/Dockerfile" \
    --build-arg "BASE_IMAGE=${LOCAL_BASE_IMAGE}" \
    --tag "${IMAGE_NAME}" \
    "${ROOT_DIR}"; then
    fail \
      "The application or Docker image build failed." \
      "Fix the error above, then run this command again."
  fi

  info ""
  info "Built ${IMAGE_NAME}"
}

main "$@"
