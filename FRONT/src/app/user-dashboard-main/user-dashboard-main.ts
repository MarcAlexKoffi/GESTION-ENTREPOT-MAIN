import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

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

@Component({
  selector: 'app-user-dashboard-main',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-dashboard-main.html',
  styleUrl: './user-dashboard-main.scss',
})
export class UserDashboardMain implements OnInit {
  // contexte
  currentUser: StoredUser | null = null;
  entrepotId: number | null = null;
  entrepotName = '—';

  // filtre
  period: 'today' | 'week' | 'month' | 'year' | 'specific' = 'today';
  filterDate: string = '';

  // data
  trucks: Truck[] = []; // Raw list
  filteredTrucks: Truck[] = []; // Display list

  constructor(private truckService: TruckService, private warehouseService: WarehouseService) {}

  ngOnInit(): void {
    // initialize date to today for the input if needed, or leave empty until specific selected
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
      this.filteredTrucks = [];
      return;
    }

    this.truckService.getTrucks(this.entrepotId).subscribe({
      next: (data) => {
        this.trucks = data;
        this.applyFilters();
      },
      error: (err) => console.error('Erreur loading trucks', err),
    });
  }

  applyFilters() {
    let list = [...this.trucks];
    const now = new Date();
    
    // Date utils
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentDay = now.getDay() || 7; 
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - (currentDay - 1));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    if (this.period === 'specific' && this.filterDate) {
      const target = new Date(this.filterDate).toDateString();
      list = list.filter(t => t.heureArrivee && new Date(t.heureArrivee).toDateString() === target);
    } else if (this.period === 'today') {
      list = list.filter(t => t.heureArrivee && new Date(t.heureArrivee).toDateString() === now.toDateString());
    } else if (this.period === 'week') {
      list = list.filter(t => t.heureArrivee && new Date(t.heureArrivee) >= startOfWeek);
    } else if (this.period === 'month') {
      list = list.filter(t => t.heureArrivee && new Date(t.heureArrivee) >= startOfMonth);
    } else if (this.period === 'year') {
      list = list.filter(t => t.heureArrivee && new Date(t.heureArrivee) >= startOfYear);
    }

    this.filteredTrucks = list;
  }

  onPeriodChange() {
    if (this.period !== 'specific') {
      this.filterDate = '';
    }
    this.applyFilters();
  }

  onDateChange() {
    if (this.filterDate) {
      this.period = 'specific';
    } else {
        // If user clears date, revert to default? or just stay specific (empty)
        this.period = 'today'; 
    }
    this.applyFilters();
  }

  // -------------------------
  // KPIs dynamiques
  // -------------------------
  get totalPresents(): number {
    return this.filteredTrucks.length;
  }

  get enAttente(): number {
    return this.filteredTrucks.filter((t) => t.statut === 'En attente').length;
  }

  // interprétation actuelle du flux UserEntrepot : "Validé" = en cours côté gérant
  get enDechargement(): number {
    return this.filteredTrucks.filter((t) => t.statut === 'Validé' && t.advancedStatus !== 'ACCEPTE_FINAL')
      .length;
  }

  get decharges(): number {
    return this.filteredTrucks.filter((t) => t.advancedStatus === 'ACCEPTE_FINAL').length;
  }

  get annules(): number {
    return this.filteredTrucks.filter((t) => t.statut === 'Annulé').length;
  }

  // "Attente décision admin" : on s’appuie sur unreadForAdmin (déjà utilisé dans ton flux)
  get attenteDecisionAdmin(): number {
    return this.filteredTrucks.filter((t) => t.unreadForAdmin === true).length;
  }

  get refusesAttenteGerant(): number {
    return this.filteredTrucks.filter((t) => t.advancedStatus === 'REFUSE_EN_ATTENTE_GERANT').length;
  }

  get refusesRenvoyes(): number {
    return this.filteredTrucks.filter((t) => t.advancedStatus === 'REFUSE_RENVOYE').length;
  }

  get refusesRintegres(): number {
    return this.filteredTrucks.filter((t) => t.advancedStatus === 'REFUSE_REINTEGRE').length;
  }
}
