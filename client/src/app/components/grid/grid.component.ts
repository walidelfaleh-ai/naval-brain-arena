import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CellModel } from '../../models/cell.model';

@Component({
  selector: 'app-grid',
  templateUrl: './grid.component.html',
  standalone: false
})
export class GridComponent {
  @Input() rows: CellModel[][] = [];
  @Input() title = '';
  @Input() clickable = false;
  @Input() disabled = false;
  @Input() hideShips = false;
  @Input() rowLabels: string[] = [];
  @Input() colLabels: string[] = [];
  @Input() cellSize = 38;

  @Output() cellSelected = new EventEmitter<{ row: number; col: number }>();

  selectCell(cell: CellModel): void {
    if (this.clickable && !this.disabled && !cell.attacked) {
      this.cellSelected.emit({ row: cell.row, col: cell.col });
    }
  }

  cellText(cell: CellModel): string {
    if (cell.result === 'hit') {
      return 'X';
    }

    if (cell.result === 'miss') {
      return 'V';
    }

    if (cell.hasShip && !this.hideShips) {
      return 'B';
    }

    return '';
  }
}
