import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { GameState, PlayerAvatar } from './models/game-state.model';
import { GameService } from './services/game.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: false
})
export class AppComponent implements OnInit, OnDestroy {
  readonly avatarOptions: PlayerAvatar[] = [
    { id: 'captain-ray', icon: '\u{1F9D1}\u200D\u2708\uFE0F', tint: '#38bdf8', source: 'preset' },
    { id: 'iron-beard', icon: '\u{1F9D4}', tint: '#f59e0b', source: 'preset' },
    { id: 'storm-lady', icon: '\u{1F469}\u200D\u2708\uFE0F', tint: '#f472b6', source: 'preset' },
    { id: 'shark-eye', icon: '\u{1F63C}', tint: '#60a5fa', source: 'preset' },
    { id: 'bolt-face', icon: '\u{1F916}', tint: '#a78bfa', source: 'preset' },
    { id: 'wave-fox', icon: '\u{1F98A}', tint: '#fb7185', source: 'preset' },
    { id: 'sea-panda', icon: '\u{1F43C}', tint: '#34d399', source: 'preset' },
    { id: 'ember-owl', icon: '\u{1F989}', tint: '#f97316', source: 'preset' }
  ];

  state: GameState | null = null;
  username = '';
  selectedAvatarId = this.avatarOptions[0].id;
  uploadedAvatarDataUrl: string | null = null;
  private readonly subscription = new Subscription();
  showVersusIntro = false;
  private introTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(public readonly gameService: GameService) {}

  ngOnInit(): void {
    this.restoreIdentity();
    this.subscription.add(
      this.gameService.state$.subscribe((state) => {
        const previousPhase = this.state?.phase;
        this.state = state;

        if (state.username && !this.username) {
          this.username = state.username;
        }

        if (state.phase === 'battle' && previousPhase !== 'battle') {
          this.launchVersusIntro();
        }

        if (state.phase === 'home' || state.phase === 'matching') {
          this.clearVersusIntro();
        }
      })
    );

    this.gameService.connect();
  }

  ngOnDestroy(): void {
    this.clearVersusIntro();
    this.subscription.unsubscribe();
  }

  start(): void {
    const trimmed = this.prepareIdentityForMatch();
    if (!trimmed) {
      return;
    }

    this.gameService.startMatch(trimmed, this.currentAvatarPayload());
  }

  createFriendMatch(): void {
    const trimmed = this.prepareIdentityForMatch();
    if (!trimmed) {
      return;
    }

    this.gameService.createPrivateMatch(trimmed, this.currentAvatarPayload());
  }

  joinFriendMatch(code: string): void {
    const trimmed = this.prepareIdentityForMatch();
    const normalizedCode = code.trim().toUpperCase();
    if (!trimmed || normalizedCode.length !== 6) {
      return;
    }

    this.gameService.joinPrivateMatch(trimmed, normalizedCode, this.currentAvatarPayload());
  }

  attack(row: number, col: number): void {
    this.gameService.attack(row, col);
  }

  playAgain(): void {
    this.gameService.playAgain();
  }

  updateAvatar(avatarId: string): void {
    this.selectedAvatarId = avatarId;
    this.uploadedAvatarDataUrl = null;
    this.persistIdentity(this.username.trim(), avatarId, null);
  }

  updateUploadedAvatar(imageDataUrl: string | null): void {
    this.uploadedAvatarDataUrl = imageDataUrl;
    if (imageDataUrl) {
      this.selectedAvatarId = '';
    } else if (!this.selectedAvatarId) {
      this.selectedAvatarId = this.avatarOptions[0].id;
    }
    this.persistIdentity(this.username.trim(), this.selectedAvatarId, this.uploadedAvatarDataUrl);
  }

  private launchVersusIntro(): void {
    this.clearVersusIntro();
    this.showVersusIntro = true;
    this.introTimeout = setTimeout(() => {
      this.showVersusIntro = false;
      this.introTimeout = null;
    }, 1800);
  }

  private clearVersusIntro(): void {
    this.showVersusIntro = false;
    if (this.introTimeout) {
      clearTimeout(this.introTimeout);
      this.introTimeout = null;
    }
  }

  private restoreIdentity(): void {
    const stored = localStorage.getItem('naval-duel.identity');
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as {
        username?: string;
        avatarId?: string | null;
        uploadedAvatarDataUrl?: string | null;
      };

      if (parsed.username) {
        this.username = parsed.username;
      }

      if (parsed.uploadedAvatarDataUrl) {
        this.uploadedAvatarDataUrl = parsed.uploadedAvatarDataUrl;
        this.selectedAvatarId = '';
      } else if (parsed.avatarId && this.avatarOptions.some((avatar) => avatar.id === parsed.avatarId)) {
        this.selectedAvatarId = parsed.avatarId;
      }
    } catch {
      localStorage.removeItem('naval-duel.identity');
    }
  }

  private prepareIdentityForMatch(): string | null {
    const trimmed = this.username.trim();
    if (!trimmed) {
      return null;
    }

    this.persistIdentity(trimmed, this.selectedAvatarId, this.uploadedAvatarDataUrl);
    return trimmed;
  }

  private currentAvatarPayload(): { avatarId: string | null; uploadedAvatarDataUrl: string | null } {
    return {
      avatarId: this.uploadedAvatarDataUrl ? null : this.selectedAvatarId,
      uploadedAvatarDataUrl: this.uploadedAvatarDataUrl
    };
  }

  private persistIdentity(username: string, avatarId: string | null, uploadedAvatarDataUrl: string | null): void {
    localStorage.setItem('naval-duel.identity', JSON.stringify({ username, avatarId, uploadedAvatarDataUrl }));
  }
}
