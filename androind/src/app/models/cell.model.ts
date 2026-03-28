export type AttackResult = 'unknown' | 'hit' | 'miss';

export interface CellModel {
  row: number;
  col: number;
  label: string;
  attacked: boolean;
  result: AttackResult;
  hasShip: boolean;
  shipId?: string;
  shipSegmentHit?: boolean;
}
