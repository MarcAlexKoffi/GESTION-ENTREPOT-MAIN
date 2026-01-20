import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, ToastMessage } from '../services/toast.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      <div *ngFor="let toast of toasts" class="toast toast-{{ toast.type }} slide-in-right">
        <div class="toast-content">
          <span class="material-symbols-outlined notranslate icon">{{ getIcon(toast.type) }}</span>
          <span class="message">{{ toast.message }}</span>
        </div>
        <button class="close-btn" (click)="remove(toast)">
          <span class="material-symbols-outlined notranslate">close</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none; /* Allow clicks through container */
    }

    .toast {
      background: white;
      border-radius: 8px;
      padding: 12px 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-width: 300px;
      max-width: 400px;
      pointer-events: auto; /* Catch clicks on toasts */
      animation: slideIn 0.3s cubic-bezier(0.21, 1.02, 0.73, 1);
      border-left: 4px solid #ccc;
    }

    .toast-success { border-left-color: #16a34a; }
    .toast-error { border-left-color: #ef4444; }
    .toast-info { border-left-color: #3b82f6; }
    .toast-warning { border-left-color: #f59e0b; }

    .toast-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .message {
      font-size: 0.95rem;
      font-weight: 500;
      color: #1e293b;
      line-height: 1.4;
    }

    .icon {
      font-size: 24px;
      flex-shrink: 0;
    }
    .toast-success .icon { color: #16a34a; }
    .toast-error .icon { color: #ef4444; }
    .toast-info .icon { color: #3b82f6; }
    .toast-warning .icon { color: #f59e0b; }

    .close-btn {
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background 0.2s;
      flex-shrink: 0;
    }
    .close-btn:hover { background: #f1f5f9; color: #64748b; }

    @keyframes slideIn {
      from { opacity: 0; transform: translateX(100%); }
      to { opacity: 1; transform: translateX(0); }
    }
    
    @media (max-width: 640px) {
        .toast-container {
            top: auto;
            bottom: 20px;
            right: 10px;
            left: 10px;
            align-items: center;
        }
        .toast {
            width: 100%;
            max-width: none;
        }
    }
  `]
})
export class ToastComponent implements OnInit, OnDestroy {
  toasts: ToastMessage[] = [];
  private toastService = inject(ToastService);
  private sub: Subscription | null = null;

  ngOnInit() {
    this.sub = this.toastService.toast$.subscribe(toast => {
      this.toasts.push(toast);
      if (toast.duration && toast.duration > 0) {
        setTimeout(() => this.remove(toast), toast.duration);
      }
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  remove(toast: ToastMessage) {
    this.toasts = this.toasts.filter(t => t !== toast);
  }

  getIcon(type: string): string {
    switch (type) {
      case 'success': return 'check_circle';
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'info';
    }
  }
}
