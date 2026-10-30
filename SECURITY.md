# Security Policy

## Supported Versions

We actively provide security patches and updates for the following versions of VetroLog:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## Reporting a Vulnerability

The VetroLog team takes security vulnerabilities seriously. We appreciate your efforts to responsibly disclose findings.

### How to Report

- **Preferred Method**: Use GitHub's [Private Vulnerability Reporting](https://github.com/Tanvirul-swe/vetrolog/security/advisories/new) feature on the repository. This allows you to privately communicate with maintainers and collaborate on a fix without disclosing the issue publicly.
- **Alternative Method**: If you cannot use GitHub Security Advisories, please contact the maintainer directly via GitHub profile or email at [contact email / GitHub issue placeholder].

### What to Include in Your Report

To help us triage and resolve the issue quickly, please provide:
1. **Description**: A clear summary of the vulnerability and its potential impact.
2. **Steps to Reproduce**: A minimal, reproducible example or step-by-step instructions.
3. **Environment**:
   - VetroLog version (e.g., `v1.4.0`)
   - Operating system and architecture (e.g., macOS Sonoma arm64, Windows 11 x64, Ubuntu 22.04)
   - Connection mode (Mobile ADB or Remote DB engine)
4. **Proof of Concept**: Any relevant logs, screenshots, or code snippets (ensure no sensitive credentials or personal tokens are included).

---

### Response Timeline

- **Initial Acknowledgement**: Within **48 hours** of receiving the report.
- **Triage & Assessment**: We will assess severity and confirm whether the issue is reproducible within **5 business days**.
- **Fix & Advisory**: We will work on a patch in a private repository/fork and coordinate a release date with you before publishing a security advisory and CVE if applicable.

> **Please DO NOT file public GitHub issues for security vulnerabilities.** Public issues can expose users to risk before a patch is ready.
