export type Orientation = 'horizontal' | 'vertical';

export interface ShipModel {
  id: string;
  name: string;
  size: number;
  orientation: Orientation;
  positions: Array<{ row: number; col: number }>;
  hits: number;
  sunk: boolean;
}
