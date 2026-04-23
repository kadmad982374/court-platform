# ============================================================
# backend/Dockerfile
# Multi-stage build: Maven → Java 21 runtime
# ============================================================

# ── Stage 1: build ──────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
# Download dependencies first (cached layer)
RUN mvn dependency:go-offline -q
COPY src ./src
RUN mvn clean package -DskipTests -q

# ── Stage 2: runtime ────────────────────────────────────────
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Create non-root user
RUN addgroup --system sla && adduser --system --ingroup sla sla

# Copy jar
COPY --from=build /app/target/state-litigation-backend.jar app.jar

# Attachment data directory (mounted as volume)
RUN mkdir -p /app/attachments-data && chown sla:sla /app/attachments-data

USER sla

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]


