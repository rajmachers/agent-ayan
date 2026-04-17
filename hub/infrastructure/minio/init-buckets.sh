#!/bin/sh
# Agent-Ayan MinIO Bucket Initialization
set -e

echo "Waiting for MinIO to be ready..."
sleep 10

echo "Configuring MinIO client..."
mc alias set ayan http://hub-minio:9000 "${MINIO_ROOT_USER:-ayan_minio_admin}" "${MINIO_ROOT_PASSWORD:-changeme_in_production}"

echo "Creating storage buckets..."

mc mb ayan/recordings --ignore-existing
mc anonymous set download ayan/recordings

mc mb ayan/org-assets --ignore-existing
mc anonymous set download ayan/org-assets

mc mb ayan/system-assets --ignore-existing
mc anonymous set download ayan/system-assets

mc mb ayan/exports --ignore-existing
mc anonymous set none ayan/exports

mc mb ayan/backups --ignore-existing
mc anonymous set none ayan/backups

mc mb ayan/evidence --ignore-existing
mc anonymous set none ayan/evidence

echo "MinIO initialization completed!"
mc ls ayan/
