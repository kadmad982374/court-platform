---
name: 6-Phase Production-Readiness Initiative
description: The qr-service-01 + user-service-01 stack went through a 6-phase prod-readiness program ending 2026-05-04 with a SHIP verdict on this date.
type: project
---

The qr-service-01 + user-service-01 stack completed a 6-phase production-readiness initiative on 2026-05-04, with Phase 6 being the final consolidated QA. Phases covered: (1) security lockdown, (2) URL routing /menu/{slug} carry-forward, (3) config hardening + input validation, (4) Bucket4j rate limiting, (5) deploy infra (Caddy single-compose, gitleaks CI, CycloneDX SBOM, digest-pinned Dockerfiles), (6) final QA. Final verdict: SHIP-APPROVED conditional on operator pre-flight (DNS for qr.syrianorder.com, secrets in .env, firewall 80/443/443udp).

**Why:** The user is preparing a Hetzner single-VM production deploy for syrianorder.com — the consolidated stack ships through `docker-compose.prod.yml` with Caddy as the only public-facing service.

**How to apply:** When asked about prior prod-readiness state, the canonical reference points are: `DEPLOY.md` (runbook), `docker-compose.prod.yml` (stack), `Caddyfile` (TLS edge). All ports unpublished except Caddy 80/443/443udp. JWT_SECRET fail-fast lives at `com/qr/config/JwtService.java` and `com/user/config/JwtService.java` (refuses two known dev placeholder strings). Any deviation from these guarantees in future work is a regression.
