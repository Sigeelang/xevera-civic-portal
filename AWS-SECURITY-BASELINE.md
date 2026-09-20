# Xevera Civic Portal — AWS Security Baseline

**Account:** `430611185629`
**Region:** `ap-southeast-2` (Sydney), with a `us-east-1` billing alarm
**Date applied:** 2026-09-16
**Scope:** AWS account-level controls only. No changes were made to the EC2
host or the running portal.

---

## 1. What changed (before → after)

| Control | Before | After |
|---|---|---|
| Root access keys | **1 active key** (`AKIAWIQTNH7OYRZY3EPY`) | **0 keys — deleted** |
| Dedicated admin identity | none (root was used) | IAM user `xevera-admin` with MFA-capable credentials |
| IAM password policy | **not set** | set (see §3) |
| CloudTrail | **no trails — no API audit log** | `xevera-trail` (multi-Region, log-file validation, logging on) |
| IAM Access Analyzer | none | `xevera-account-analyzer` (account scope) |
| EBS encryption by default | **false** | **true** |
| S3 account Block Public Access | **not configured** | all 4 settings enabled |
| CloudWatch alarms | **none** | 5 alarms wired to email SNS topics |
| S3 buckets | none | 1 private CloudTrail log bucket (versioned, SSE, PAB) |

---

## 2. Root access key retirement

Root access keys cannot be managed by an IAM user, so the safe order was:
create the IAM admin **first**, verify it, *then* have root delete its own key.

```
# 1. created before removal (verified working):
aws sts get-caller-identity --profile xevera-admin
#   → arn:aws:iam::430611185629:user/xevera-admin

# 2. root deleted its own key:
aws iam delete-access-key --access-key-id AKIAWIQTNH7OYRZY3EPY

# 3. verification — root credentials now rejected:
aws sts get-caller-identity            # (was root)
#   → InvalidClientTokenId
```

The local CLI default profile now authenticates as `xevera-admin`.

> **Note:** `xevera-admin` currently holds `AdministratorAccess`. This is
> acceptable as a bootstrap identity, but the long-term recommendation is to
> replace it with short-lived role-based access and least privilege.

---

## 3. Account baseline

```bash
# Password policy
aws iam update-account-password-policy \
  --minimum-password-length 12 --require-symbols --require-numbers \
  --require-uppercase-characters --require-lowercase-characters \
  --allow-users-to-change-password --max-password-age 90 \
  --password-reuse-prevention 5
# Verified: MinLength 12, all complexity true, MaxPasswordAge 90, ReusePrevention 5

# Access Analyzer
aws accessanalyzer create-analyzer --analyzer-name xevera-account-analyzer --type ACCOUNT
#   → arn:aws:access-analyzer:ap-southeast-2:430611185629:analyzer/xevera-account-analyzer

# EBS default encryption
aws ec2 enable-ebs-encryption-by-default
# Verified: EbsEncryptionByDefault = true
# (applies to NEW volumes; the two existing 30 GB volumes remain unencrypted
#  and would need snapshot-recreate to encrypt)

# S3 account-level Block Public Access
aws s3control put-public-access-block --account-id 430611185629 \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
# Verified: all four settings = true
```

---

## 4. CloudTrail (API audit logging)

```bash
aws s3api create-bucket --bucket xevera-cloudtrail-logs-430611185629 \
  --create-bucket-configuration LocationConstraint=ap-southeast-2
aws s3api put-bucket-versioning --bucket xevera-cloudtrail-logs-430611185629 \
  --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket xevera-cloudtrail-logs-430611185629 \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}'
# Bucket policy restricts writes to this exact trail via aws:SourceArn.

aws cloudtrail create-trail --name xevera-trail \
  --s3-bucket-name xevera-cloudtrail-logs-430611185629 \
  --is-multi-region-trail --enable-log-file-validation
aws cloudtrail start-logging --name xevera-trail
```

Verified state:

```
Name: xevera-trail   MultiRegion: true   LogValidation: true
Bucket: xevera-cloudtrail-logs-430611185629   Home: ap-southeast-2
IsLogging: true     (objects confirmed under AWSLogs/430611185629/)
```

Log-file validation means any tampering with delivered logs is detectable via
the digest files. The bucket is private, versioned and encrypted.

---

## 5. Monitoring and alarms

SNS topics (both **pending email confirmation** — see §7):

| Topic | Region | Purpose |
|---|---|---|
| `xevera-security-alerts` | ap-southeast-2 | EC2 / RDS alarms |
| `xevera-billing-alerts` | us-east-1 | billing alarm (billing metrics exist only in us-east-1) |

Alarms created (all actions → the SNS topic above):

| Alarm | Metric | Condition |
|---|---|---|
| `xevera-ec2-status-check-failed` | `AWS/EC2 StatusCheckFailed` | ≥ 1 for 2 min |
| `xevera-ec2-cpu-high` | `AWS/EC2 CPUUtilization` | > 80% for 15 min |
| `xevera-rds-cpu-high` | `AWS/RDS CPUUtilization` | > 80% for 15 min |
| `xevera-rds-storage-low` | `AWS/RDS FreeStorageSpace` | < 2 GB |
| `xevera-billing-estimated-charges` | `AWS/Billing EstimatedCharges` | > USD 5 |

> The billing alarm additionally requires **Billing preferences → Receive
> Billing Alerts** to be enabled in the root account, otherwise the
> `EstimatedCharges` metric is never published.

---

## 6. Services deliberately NOT enabled (and why)

| Service | Why it does not apply |
|---|---|
| **AWS WAF** | Cannot attach to a bare EC2 instance — requires an ALB, CloudFront or API Gateway. Adding an ALB costs ~USD 16–20/month. Not appropriate for this architecture. |
| **Amazon Macie** | Scans S3 only. There is one private log bucket containing no sensitive data; there is no resident data in S3. |
| **AWS ACM** | Public certificates require DNS (CNAME) or email domain validation. The portal uses a DuckDNS subdomain that cannot publish validation records. TLS is provided by Let's Encrypt via Certbot on the host. |
| **AWS Shield Advanced** | USD ~3,000/month. **Shield Standard** (L3/L4 DDoS protection) is already active automatically and free on every AWS account. |
| **AWS Config** | Useful but billed per configuration item. Deferred to keep this phase effectively free. |
| **Amazon GuardDuty / Security Hub** | 30-day free trials, then low-cost. Deferred to Phase 2. |
| **AWS Backup** | RDS automated backups are already enabled (1-day retention, free-tier maximum). |
| **KMS customer-managed keys** | USD 1/key/month. Encryption currently uses AWS-managed keys (`alias/aws/rds`, `alias/aws/ebs`, `alias/aws/secretsmanager`). |

---

## 7. Actions still required from a human

### 7.1 Confirm the SNS email subscriptions
Two confirmation emails were sent to `xeveraportal@gmail.com`
(from `AWS Notifications`). Until each **Confirm subscription** link is
clicked, alarms will change state but send no email.

### 7.2 Enable root MFA (highest priority)
1. Sign in to the AWS Console **as the root user** (using the account email,
   not `xevera-admin`).
2. Top-right account menu → **Security credentials**.
3. Under **Multi-factor authentication (MFA)** → **Assign MFA device**.
4. Name it `root-mfa`, select **Authenticator app**, then **Next**.
5. Scan the QR code with Google Authenticator / Authy / Microsoft
   Authenticator.
6. Enter **two consecutive** 6-digit codes and click **Add MFA**.

Result: root shows `MFA devices: 1`.

### 7.3 Enable MFA for `xevera-admin`
1. Sign in as `xevera-admin` (or, as an admin, **IAM → Users → xevera-admin →
   Security credentials**).
2. **Assign MFA device** → **Authenticator app** → scan → add.

### 7.4 Enable Billing Alerts (needed for the billing alarm to fire)
Console → **Billing and Cost Management → Billing preferences** → enable
**Receive Billing Alerts** → Save.

---

## 8. Verification commands

```bash
aws sts get-caller-identity                 # → user/xevera-admin (never root)
aws iam get-account-password-policy         # → policy present
aws accessanalyzer list-analyzers           # → xevera-account-analyzer, ACTIVE
aws ec2 get-ebs-encryption-by-default       # → true
aws s3control get-public-access-block --account-id 430611185629   # → all true
aws cloudtrail get-trail-status --name xevera-trail               # → IsLogging true
aws cloudwatch describe-alarms --query 'MetricAlarms[].[AlarmName,StateValue]' --output text
aws s3api list-objects-v2 --bucket xevera-cloudtrail-logs-430611185629 --max-items 3
```

---

## 9. Cost

| Item | Monthly |
|---|---|
| CloudTrail (first copy of management events) | **$0.00** |
| S3 log storage (a few MB/month) | ~$0.01 |
| IAM, Access Analyzer, password policy, S3 PAB, EBS default encryption | **$0.00** |
| 5 CloudWatch alarms ($0.10 each) | ~$0.50 |
| **Total** | **~$0.51/month** |

---

## 10. Known residual risks

- **`xevera-admin` has `AdministratorAccess`** — broad. Consider narrowing to
  only the services used, or replacing with IAM Identity Center / roles.
- **Root MFA is still disabled** until §7.2 is completed. This is the single
  highest-severity outstanding item; the root account has no access keys, but
  console sign-in remains unprotected.
- **Existing EBS volumes are unencrypted** — default encryption applies only to
  new volumes. Encrypting the existing ones requires snapshot-copy-recreate.
- **No GuardDuty / Security Hub / Config** — Phase 2, deferred for cost.
- **No VPC Flow Logs** — Phase 3.
