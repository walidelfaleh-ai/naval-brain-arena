import { Component, EventEmitter, Input, Output } from '@angular/core';
import { GameState, PlayerAvatar } from '../../models/game-state.model';

@Component({
  selector: 'app-lobby',
  templateUrl: './lobby.component.html',
  standalone: false
})
export class LobbyComponent {
  @Input() state: GameState | null = null;
  @Input() username = '';
  @Input() selectedAvatarId = '';
  @Input() uploadedAvatarDataUrl: string | null = null;
  @Input() avatarOptions: PlayerAvatar[] = [];
  @Output() usernameChange = new EventEmitter<string>();
  @Output() avatarChange = new EventEmitter<string>();
  @Output() uploadedAvatarChange = new EventEmitter<string | null>();
  @Output() startRequested = new EventEmitter<void>();
  @Output() createFriendRequested = new EventEmitter<void>();
  @Output() joinFriendRequested = new EventEmitter<string>();
  friendCode = '';
  lobbyStep: 'home' | 'join-friend' = 'home';

  updateUsername(value: string): void {
    this.usernameChange.emit(value);
  }

  selectAvatar(avatarId: string): void {
    this.avatarChange.emit(avatarId);
  }

  async onAvatarFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    try {
      const resizedDataUrl = await this.resizeAvatar(file);
      this.uploadedAvatarChange.emit(resizedDataUrl);
    } finally {
      input.value = '';
    }
  }

  clearUploadedAvatar(): void {
    this.uploadedAvatarChange.emit(null);
  }

  start(): void {
    this.startRequested.emit();
  }

  createFriendMatch(): void {
    this.createFriendRequested.emit();
  }

  openJoinFriend(): void {
    this.lobbyStep = 'join-friend';
  }

  backToHome(): void {
    this.lobbyStep = 'home';
  }

  joinFriendMatch(): void {
    this.joinFriendRequested.emit(this.friendCode.trim().toUpperCase());
  }

  private resizeAvatar(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Unable to read image.'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('Unable to load image.'));
        image.onload = () => {
          const size = 180;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const context = canvas.getContext('2d');
          if (!context) {
            reject(new Error('Unable to create canvas context.'));
            return;
          }

          const scale = Math.max(size / image.width, size / image.height);
          const drawWidth = image.width * scale;
          const drawHeight = image.height * scale;
          const offsetX = (size - drawWidth) / 2;
          const offsetY = (size - drawHeight) / 2;

          context.fillStyle = '#0f172a';
          context.fillRect(0, 0, size, size);
          context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        image.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }
}
