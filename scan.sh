#!/bin/env bash
shopt -s globstar nullglob

draw_box() {
    local msg="$1"
    local width=$((${#msg} + 34))
    local border=$(printf '%*s' "$width" | tr ' ' '#')
    echo
    echo -e "\n$border"
    echo "################ $msg "################
    echo "$border"
    echo
}

# docker run --rm  -v $HOME/.trivy/plugins:/root/.trivy/plugins aquasec/trivy:latest plugin install github.com/aquasecurity/trivy-plugin-kubectl

cache_args="-v $HOME/.trivy/plugins:/root/.trivy/plugins -v $HOME/.cache/trivy:/root/.cache/"
images=$(for dockerfile in **/Dockerfile; do
  grep -i '^FROM ' "$dockerfile" | awk '{print $2}'
done | sort -u)

for image in $images; do
  draw_box "Scanning $image"
  docker run $cache_args aquasec/trivy image $image
done

draw_box "Scanning project"
docker run $cache_args -v .:/project:ro aquasec/trivy fs /project
