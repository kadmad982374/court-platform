// Mini-Phase A — Assign Lawyer (D-046).
//
// Read-only client for the new conservative endpoint:
//   GET /api/v1/users
//       ?branchId={number}
//       &departmentId={number}
//       &membershipType=STATE_LAWYER  (only STATE_LAWYER supported in A)
//       &activeOnly=true              (default true)
//
// Backend mirror: sy.gov.sla.identity.api.AssignableLawyerDto
//
// Reference:
//   docs/project/BACKEND_GAP_PHASE11_ASSIGN_LAWYER.md
//   docs/project/PROJECT_ASSUMPTIONS_AND_DECISIONS.md (D-046)
//
// IMPORTANT: This is NOT a generic Users-Admin client. Mini-Phase B will
// introduce dedicated user CRUD endpoints + types under a separate module.

import { http } from '@/shared/api/http';

export interface AssignableLawyerOption {
  id: number;
  fullName: string;
  username: string;
  active: boolean;
}

export async function listAssignableLawyers(
  branchId: number,
  departmentId: number,
  opts: { activeOnly?: boolean } = {},
): Promise<AssignableLawyerOption[]> {
  const r = await http.get<AssignableLawyerOption[]>('/users', {
    params: {
      branchId,
      departmentId,
      membershipType: 'STATE_LAWYER',
      activeOnly: opts.activeOnly ?? true,
    },
  });
  return r.data;
}

