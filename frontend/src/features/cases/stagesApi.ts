import { http } from '@/shared/api/http';
import type {
  CaseDecision,
  FinalizeRequest,
  HearingProgressionEntry,
  RolloverHearingRequest,
  Stage,
  StageProgression,
} from '@/shared/types/domain';

export async function getStage(stageId: number): Promise<Stage> {
  const r = await http.get<Stage>(`/stages/${stageId}`);
  return r.data;
}

export async function getStageProgression(stageId: number): Promise<StageProgression> {
  const r = await http.get<StageProgression>(`/stages/${stageId}/progression`);
  return r.data;
}

export async function getStageHistory(stageId: number): Promise<HearingProgressionEntry[]> {
  const r = await http.get<HearingProgressionEntry[]>(`/stages/${stageId}/hearing-history`);
  return r.data;
}

export async function rolloverHearing(
  stageId: number, body: RolloverHearingRequest,
): Promise<HearingProgressionEntry> {
  const r = await http.post<HearingProgressionEntry>(
    `/stages/${stageId}/rollover-hearing`,
    body,
  );
  return r.data;
}

export async function finalizeStage(
  stageId: number, body: FinalizeRequest,
): Promise<CaseDecision> {
  const r = await http.post<CaseDecision>(`/stages/${stageId}/finalize`, body);
  return r.data;
}

/** صف من جدول مرجع أسباب التأجيل (D-008/D-022). */
export interface PostponementReasonOption {
  code: string;
  labelAr: string;
  active: boolean;
}

/**
 * يجلب قائمة أسباب التأجيل المعيارية للعرض في قائمة منسدلة.
 * الافتراضي: العمليّة (active) فقط.
 */
export async function getPostponementReasons(): Promise<PostponementReasonOption[]> {
  const r = await http.get<PostponementReasonOption[]>('/postponement-reasons');
  return r.data;
}
