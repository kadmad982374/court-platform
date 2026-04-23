/**
 * Demo / seed users — passwords from V20/V21/V22 dev seed migrations.
 * All passwords are the same dev default: ChangeMe!2026
 *
 * See: docs/project/DEMO_SEED_DATA_PLAN.md
 */
export const DEMO_PASSWORD = 'ChangeMe!2026';

export interface DemoUser {
  username: string;
  password: string;
  role: string;
  description: string;
}

export const USERS = {
  admin: {
    username: 'admin',
    password: DEMO_PASSWORD,
    role: 'CENTRAL_SUPERVISOR',
    description: 'Bootstrap central supervisor — sees all cases (read).',
  },
  branchHead: {
    username: 'head_dam',
    password: DEMO_PASSWORD,
    role: 'BRANCH_HEAD',
    description: 'Branch head — Damascus.',
  },
  sectionHead: {
    username: 'section_fi_dam',
    password: DEMO_PASSWORD,
    role: 'SECTION_HEAD',
    description: 'Section head — Damascus / FIRST_INSTANCE. Creates cases, assigns lawyers.',
  },
  clerk: {
    username: 'clerk_fi_dam',
    password: DEMO_PASSWORD,
    role: 'ADMIN_CLERK',
    description: 'Admin clerk WITH ASSIGN_LAWYER + 8 other delegations.',
  },
  clerkNoAssign: {
    username: 'clerk2_fi_dam',
    password: DEMO_PASSWORD,
    role: 'ADMIN_CLERK',
    description: 'Admin clerk WITHOUT ASSIGN_LAWYER delegation (negative-path).',
  },
  lawyer: {
    username: 'lawyer_fi_dam',
    password: DEMO_PASSWORD,
    role: 'STATE_LAWYER',
    description: 'Active lawyer — owns cases 2 & 4 in V22 seed.',
  },
  lawyer2: {
    username: 'lawyer2_fi_dam',
    password: DEMO_PASSWORD,
    role: 'STATE_LAWYER',
    description: 'Second active lawyer in same dept (eligible for assignment).',
  },
  lawyerInactive: {
    username: 'lawyer_inactive_fi',
    password: DEMO_PASSWORD,
    role: 'STATE_LAWYER',
    description: 'Inactive lawyer — must NOT appear in assignable list.',
  },
  lawyerAppeal: {
    username: 'lawyer_app_dam',
    password: DEMO_PASSWORD,
    role: 'STATE_LAWYER',
    description: 'Appeal-court lawyer — Damascus / APPEAL.',
  },
  viewer: {
    username: 'viewer',
    password: DEMO_PASSWORD,
    role: 'READ_ONLY_SUPERVISOR',
    description: 'Read-only supervisor.',
  },
} satisfies Record<string, DemoUser>;

export type UserKey = keyof typeof USERS;

