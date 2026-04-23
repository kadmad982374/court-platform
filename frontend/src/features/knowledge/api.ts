// Phase 10 — Knowledge modules API client (Phase 7 backend, D-040..D-042).
//
// All endpoints are read-only; any authenticated user may call them. List
// endpoints already exist on the corresponding pages; this module centralizes
// the *get-by-id* calls for the new detail pages.

import { apiGet } from '@/shared/api/http';
import type {
  Circular,
  LegalLibraryItem,
  PublicEntityItem,
} from '@/shared/types/domain';

export const getLegalLibraryItem = (id: number) =>
  apiGet<LegalLibraryItem>(`/legal-library/items/${id}`);

export const getPublicEntity = (id: number) =>
  apiGet<PublicEntityItem>(`/public-entities/${id}`);

export const getCircular = (id: number) =>
  apiGet<Circular>(`/circulars/${id}`);

