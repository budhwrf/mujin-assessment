#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_IMAGE="mujin-assessment:latest"
IMAGE_REPO="mujin-assessment"
IMAGE_TAG="latest"
DEFAULT_USERNAME="budhwrf"

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

docker_config() {
  printf '%s' "${DOCKER_CONFIG:-${HOME}/.docker}/config.json"
}

logged_in_user() {
  docker info --format '{{.Username}}' 2>/dev/null || true
}

is_logged_in() {
  local current config
  current="$(logged_in_user)"
  if [[ -n "${current}" ]]; then
    return 0
  fi

  config="$(docker_config)"
  if [[ ! -f "${config}" ]]; then
    return 1
  fi

  # Browser login stores Hub credentials in the OS keychain and leaves an
  # empty auth entry. docker info does not report a username in that case.
  grep -Eq '"https://index\.docker\.io/v1/"|"https://index\.docker\.io/v1":' "${config}"
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

  if [[ -n "${DEFAULT_USERNAME}" ]]; then
    printf '%s' "${DEFAULT_USERNAME}"
    return
  fi

  local current
  current="$(logged_in_user)"
  if [[ -n "${current}" ]]; then
    printf '%s' "${current}"
    return
  fi

  fail \
    "Docker Hub username is missing." \
    "Log in, or pass your username:
  docker login
  pnpm docker:push -- YOUR_DOCKERHUB_USERNAME"
}

require_login() {
  if is_logged_in; then
    return
  fi

  fail \
    "You are not logged in to Docker Hub." \
    "Log in, then run this command again:
  docker login"
}

ensure_local_image() {
  if docker image inspect "${LOCAL_IMAGE}" >/dev/null 2>&1; then
    return
  fi

  info "Local image ${LOCAL_IMAGE} was not found. Building it first..."
  if ! docker build \
    --file "${ROOT_DIR}/Dockerfile" \
    --tag "${LOCAL_IMAGE}" \
    "${ROOT_DIR}"; then
    fail \
      "The Docker image build failed." \
      "Fix the error above, then run this command again."
  fi
}

main() {
  local username remote_image

  cd "${ROOT_DIR}"

  info "Checking Docker..."
  require_docker
  username="$(resolve_username "${1:-}")"
  require_login
  ensure_local_image

  remote_image="${username}/${IMAGE_REPO}:${IMAGE_TAG}"

  info "Tagging ${LOCAL_IMAGE} as ${remote_image}..."
  docker tag "${LOCAL_IMAGE}" "${remote_image}"

  info "Pushing ${remote_image}..."
  if ! docker push "${remote_image}"; then
    fail \
      "Docker Hub rejected the push." \
      "Confirm you are logged in as a user who can publish ${username}/${IMAGE_REPO}."
  fi

  info ""
  info "Pushed ${remote_image}"
  info "https://hub.docker.com/r/${username}/${IMAGE_REPO}"
}

main "$@"
