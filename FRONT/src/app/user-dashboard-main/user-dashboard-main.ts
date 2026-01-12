import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';

import { TruckService, Truck } from '../services/truck.service';
import { WarehouseService } from '../services/warehouse.service';

type UserRole = 'admin' | 'operator' | 'driver' | 'security';
type UserStatus = 'Actif' | 'Inactif' | 'En attente';

interface StoredUser {
  id: number;
  nom: string;
  email: string;
  username: string;
  password: string;
  role: UserRole;
  entrepotId: number | null;
  status: UserStatus;
  createdAt: string;
}

type PeriodFilter = 'day' | 'week' | 'month' | 'year';

@Component({
  selector: 'app-user-dashboard-main',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-dashboard-main.html',
  styleUrl: './user-dashboard-main.scss',
})
export class UserDashboardMain implements OnInit {
  // contexte
  currentUser: StoredUser | null = null;
  entrepotId: number | null = null;
  entrepotName = '—';

  // filtre période
  period: PeriodFilter = 'day';

  // data
  trucks: Truck[] = [];

  constructor(private truckService: TruckService, private warehouseService: WarehouseService) {}

  ngOnInit(): void {
    this.loadCurrentUser();
    this.loadEntrepotLabel();
    this.loadTrucks();
  }

  private loadCurrentUser(): void {
    // Prefer last visited entrepot (when coming from an entrepot page)
    const last = localStorage.getItem('lastVisitedEntrepot');
    if (last) {
      const n = Number(last);
      if (!Number.isNaN(n)) {
        this.entrepotId = n;
        return;
      }
    }

    const raw = localStorage.getItem('currentUser');
    if (!raw) return;

    try {
      this.currentUser = JSON.parse(raw) as StoredUser;
      this.entrepotId = this.currentUser.entrepotId;
    } catch {
      this.currentUser = null;
      this.entrepotId = null;
    }
  }

  private loadEntrepotLabel(): void {
    if (this.entrepotId === null) {
      this.entrepotName = 'Tous les entrepôts';
      return;
    }

    this.warehouseService.getWarehouse(this.entrepotId).subscribe({
      next: (w) => (this.entrepotName = w.name),
      error: () => (this.entrepotName = 'Entrepôt inconnu'),
    });
  }

  private loadTrucks(): void {
    if (!this.entrepotId) {
      console.warn('loadTrucks: No entrepotId available');
      this.trucks = [];
      return;
    }

    this.truckService.getTrucks(this.entrepotId).subscribe({
      next: (data) => {
        // Apply period filter locally on the fetched data
        this.trucks = this.applyPeriodFilter(data, this.period);
      },
      error: (err) => console.error('Erreur loading trucks', err),
    });
  }

  setPeriod(p: PeriodFilter): void {
    this.period = p;
    this.loadTrucks();
  }

  private applyPeriodFilter(list: Truck[], period: PeriodFilter): Truck[] {
    const now = new Date();
    const start = new Date(now);

    if (period === 'day') {
      start.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      start.setDate(now.getDate() - 7);
    } else if (period === 'month') {
      start.setMonth(now.getMonth() - 1);
    } else if (period === 'year') {
      start.setFullYear(now.getFullYear() - 1);
    }

    const startTime = start.getTime();

    return list.filter((t) => {
      const dateStr = t.heureArrivee || '';
      const time = new Date(dateStr).getTime();
      return !Number.isNaN(time) && time >= startTime;
    });
  }

  // -------------------------
  // KPIs dynamiques
  // -------------------------
  get totalPresents(): number {
    return this.trucks.length;
  }

  get enAttente(): number {
    return this.trucks.filter((t) => t.statut === 'En attente').length;
  }

  // interprétation actuelle du flux UserEntrepot : "Validé" = en cours côté gérant
  get enDechargement(): number {
    return this.trucks.filter((t) => t.statut === 'Validé' && t.advancedStatus !== 'ACCEPTE_FINAL')
      .length;
  }

  get decharges(): number {
    return this.trucks.filter((t) => t.advancedStatus === 'ACCEPTE_FINAL').length;
  }

  get annules(): number {
    return this.trucks.filter((t) => t.statut === 'Annulé').length;
  }

  // "Attente décision admin" : on s’appuie sur unreadForAdmin (déjà utilisé dans ton flux)
  get attenteDecisionAdmin(): number {
    return this.trucks.filter((t) => t.unreadForAdmin === true).length;
  }

  get refusesAttenteGerant(): number {
    return this.trucks.filter((t) => t.advancedStatus === 'REFUSE_EN_ATTENTE_GERANT').length;
  }

  get refusesRenvoyes(): number {
    return this.trucks.filter((t) => t.advancedStatus === 'REFUSE_RENVOYE').length;
  }

  get reintegres(): number {
    return this.trucks.filter((t) => t.advancedStatus === 'REFUSE_REINTEGRE').length;
  }
}
