import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PanelModule } from 'primeng/panel';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';

import { AppComponent } from './app.component';
import { ActionLogComponent } from './components/action-log/action-log.component';
import { GameBoardComponent } from './components/game-board/game-board.component';
import { GridComponent } from './components/grid/grid.component';
import { LobbyComponent } from './components/lobby/lobby.component';

@NgModule({
  declarations: [AppComponent, LobbyComponent, GridComponent, GameBoardComponent, ActionLogComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    PanelModule,
    ProgressSpinnerModule,
    TagModule
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
