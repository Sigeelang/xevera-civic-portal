# Agent Instructions

## Keep GitHub in sync with AWS changes
- After any change to the AWS-hosted system (EC2 application files, database schema/data, security groups, IAM, DNS, or deployment configuration), commit and push the corresponding change to `origin/main` in the same task.
- This repository is public. Never commit passwords, API keys, SMTP app passwords, private keys, tokens, or credential-bearing local documents. The untracked `AWS-XEVERA-INFRASTRUCTURE-AUDIT.md`, `XEVERA-AWS-DEPLOYMENT-GUIDE.md`, and `XEVERA-ROLE-UITEST-CHECKLIST.md` must not be committed.
- If an AWS-only change has no source-code equivalent, report that no repository change is applicable instead of creating an empty commit.
- Verify the push succeeded and include the commit hash in the final response.
