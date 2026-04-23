// Application-wide configuration. Values are read from Vite env at build time.
//
// Phase 8: API base URL defaults to '/api/v1' so the dev server can proxy to
// the Spring Boot backend on :8080 (see vite.config.ts).
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
} as const;

