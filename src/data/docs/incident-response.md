# Incident Response Guide

## Overview

This guide outlines Acme Engineering's incident response process, including severity classification, escalation paths, communication protocols, and post-mortem procedures. All engineers are expected to be familiar with this process.

## Severity Levels

### P1 — Critical

- **Definition**: Complete service outage affecting all users, data loss, or security breach
- **Examples**: Production database down, payment processing failure, authentication system unavailable
- **Response time**: Acknowledge within **5 minutes**, begin investigation immediately
- **Escalation**: Notify engineering manager within **15 minutes** if not resolved
- **Communication**: Update status page within **10 minutes**, stakeholder update every **30 minutes**
- **Resolution target**: **1 hour**

### P2 — High

- **Definition**: Major feature degradation affecting more than 25% of users
- **Examples**: Search functionality broken, API response times > 10 seconds, partial data inconsistency
- **Response time**: Acknowledge within **15 minutes**
- **Escalation**: Notify engineering manager within **1 hour** if not resolved
- **Communication**: Update status page within **30 minutes**
- **Resolution target**: **4 hours**

### P3 — Medium

- **Definition**: Minor feature issue affecting less than 25% of users, with a workaround available
- **Examples**: UI rendering bug on specific browsers, non-critical API endpoint returning incorrect data
- **Response time**: Acknowledge within **1 hour**
- **Escalation**: Discuss in next standup if not resolved within **24 hours**
- **Resolution target**: **24 hours**

### P4 — Low

- **Definition**: Cosmetic issues, minor bugs, or improvement requests
- **Examples**: Typo in error message, slight misalignment in UI, non-blocking warning in logs
- **Response time**: Acknowledge within **24 hours**
- **Resolution target**: Next sprint

## On-Call Rotation

### Schedule

On-call rotations are managed through **PagerDuty**. Each rotation lasts **1 week**, running from Monday 9:00 AM to the following Monday 9:00 AM (UTC).

### Teams

| Team | Primary Contact | Backup Contact |
|------|----------------|----------------|
| Platform | Rotates weekly | Engineering Manager |
| Backend API | Rotates weekly | Tech Lead |
| Frontend | Rotates weekly | Senior Engineer |
| Infrastructure | Rotates weekly | SRE Lead |

### Responsibilities

The on-call engineer must:

1. Respond to PagerDuty alerts within the SLA defined by severity level
2. Triage incoming issues and assign the correct severity
3. Coordinate response efforts and communicate status updates
4. Document all actions taken during the incident
5. Hand off unresolved issues to the next on-call engineer with full context

### Compensation

On-call engineers receive a **$500/week stipend** and additional compensation for incidents handled outside business hours.

## Escalation Paths

### P1 Escalation Timeline

```
0 min  — Alert fires, on-call engineer paged
5 min  — On-call acknowledges, begins investigation
15 min — If unresolved: escalate to engineering manager
30 min — If unresolved: escalate to VP of Engineering
60 min — If unresolved: escalate to CTO, all-hands war room
```

### P2 Escalation Timeline

```
0 min  — Alert fires, on-call engineer paged
15 min — On-call acknowledges, begins investigation
60 min — If unresolved: escalate to engineering manager
4 hrs  — If unresolved: escalate to VP of Engineering
```

## Communication Templates

### Status Page Update (Initial)

```
Title: [Service Name] — Investigating [Issue Description]
Body: We are currently investigating reports of [brief description]. 
Our engineering team is actively working on a resolution. 
We will provide updates every [30 minutes / 1 hour].
Impact: [Estimated number of affected users / services]
```

### Stakeholder Update (Slack #incidents)

```
🚨 Incident Update — [P1/P2/P3]
Issue: [Brief description]
Impact: [What's affected]
Status: [Investigating / Identified / Monitoring / Resolved]
Current Actions: [What the team is doing]
ETA: [Expected resolution time or "TBD"]
Incident Commander: [Name]
```

### Resolution Notification

```
✅ Resolved — [Service Name]
Issue: [What happened]
Root Cause: [Brief explanation]
Resolution: [What was done to fix it]
Duration: [How long the incident lasted]
Post-mortem: [Link to post-mortem doc] — scheduled for [date]
```

## Post-Mortem Process

### Timeline

- Post-mortem document must be drafted within **48 hours** of incident resolution
- Post-mortem review meeting scheduled within **5 business days**
- Action items from post-mortem must be added to Jira within **24 hours** of the review meeting

### Post-Mortem Template

Every post-mortem must include:

1. **Incident summary**: What happened, when, and who was affected
2. **Timeline**: Minute-by-minute account of the incident
3. **Root cause analysis**: Using the "5 Whys" technique
4. **Impact assessment**: Number of users affected, revenue impact, SLA violations
5. **What went well**: Effective responses during the incident
6. **What went poorly**: Areas for improvement
7. **Action items**: Specific, assigned, and time-bound improvements
8. **Lessons learned**: Key takeaways for the team

### Blameless Culture

Post-mortems at Acme are **blameless**. The focus is on systemic improvements, not individual fault. We ask "what failed?" not "who failed?"
