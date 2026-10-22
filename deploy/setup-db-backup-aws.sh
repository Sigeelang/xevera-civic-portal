#!/usr/bin/env bash
set -euo pipefail
umask 077

REGION="${AWS_REGION:-ap-southeast-1}"
BUCKET="${XEVERA_BACKUP_BUCKET:-xevera-db-backups}"
ROLE="${XEVERA_INSTANCE_ROLE:-InstanceRole}"
LIFECYCLE_FILE="$(mktemp /tmp/xevera-lifecycle.XXXXXX.json)"
POLICY_FILE="$(mktemp /tmp/xevera-backup-policy.XXXXXX.json)"
trap 'rm -f "$LIFECYCLE_FILE" "$POLICY_FILE"' EXIT

if aws s3api head-bucket --bucket "$BUCKET" --region "$REGION" 2>/dev/null; then
  echo "Bucket already exists: $BUCKET"
else
  aws s3api create-bucket \
    --bucket "$BUCKET" \
    --region "$REGION" \
    --create-bucket-configuration "LocationConstraint=$REGION" \
    --object-ownership BucketOwnerEnforced
fi

aws s3api put-public-access-block \
  --bucket "$BUCKET" \
  --region "$REGION" \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

aws s3api put-bucket-versioning \
  --bucket "$BUCKET" \
  --region "$REGION" \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket "$BUCKET" \
  --region "$REGION" \
  --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":false}]}'

cat > "$LIFECYCLE_FILE" <<'JSON'
{
  "Rules": [
    {
      "ID": "ExpireDailyBackups",
      "Status": "Enabled",
      "Filter": { "Prefix": "daily/" },
      "Expiration": { "Days": 90 },
      "NoncurrentVersionExpiration": { "NoncurrentDays": 30 },
      "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 1 }
    }
  ]
}
JSON

aws s3api put-bucket-lifecycle-configuration \
  --bucket "$BUCKET" \
  --region "$REGION" \
  --lifecycle-configuration "file://$LIFECYCLE_FILE"

cat > "$POLICY_FILE" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": "arn:aws:s3:::$BUCKET"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:AbortMultipartUpload"],
      "Resource": "arn:aws:s3:::$BUCKET/*"
    }
  ]
}
JSON

aws iam put-role-policy \
  --role-name "$ROLE" \
  --policy-name XeveraDbBackupS3 \
  --policy-document "file://$POLICY_FILE"

echo "S3 backup bucket and EC2 role policy are configured."
