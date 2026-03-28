import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-action-log',
  templateUrl: './action-log.component.html',
  standalone: false
})
export class ActionLogComponent {
  @Input() entries: string[] = [];
}
