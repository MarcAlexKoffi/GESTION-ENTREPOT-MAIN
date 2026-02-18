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
    // First load the user to know their role and assignment
    const raw = sessionStorage.getItem('currentUser');
    if (!raw) return;

    try {
      this.currentUser = JSON.parse(raw) as StoredUser;
      
      // If user has a specific warehouse assigned, forced usage of it
      if (this.currentUser.entrepotId) {
        this.entrepotId = this.currentUser.entrepotId;
        // Optional: clear any stale "last visited" to avoid confusion if role changes later
        localStorage.removeItem('lastVisitedEntrepot');
        return;
      }

      // Only for admins/users without fixed warehouse: check last visited
      const last = localStorage.getItem('lastVisitedEntrepot');
      if (last) {
        const n = Number(last);
        if (!Number.isNaN(n)) {
          this.entrepotId = n;
          return;
        }
      }

      // Default fallback if no last visited found
      this.entrepotId = null;

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

  loadTrucks(): void {
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
    // Utilisation de la logique identique à UserEntrepot pour filtrer par date sur le bon champ (updatedAt, refusedAt...)
    this.filteredTrucks = this.trucks.filter(t => {
      const dateToFilter = this.getDateForPeriod(t);
      return this.isInSelectedPeriod(dateToFilter);
    });
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
  // HELPERS SYNCED WITH UserEntrepot
  // -------------------------
  private findHistoryDate(truck: Truck, event: string): string | undefined {
    const list = truck.history || [];
    // On cherche la dernière occurrence de cet event (plus récent)
    for (let i = list.length - 1; i >= 0; i--) {
      // @ts-ignore
      if (list[i]?.event === event && list[i]?.date) return list[i].date;
    }
    return undefined;
  }

  private getDateForPeriod(truck: Truck): string {
    try {
      if (truck.statut === 'Annulé') {
        const adv = (truck as any).advancedStatus;
        if (adv === 'REFUSE_RENVOYE') {
          return (
            (truck as any).renvoyeAt ||
            this.findHistoryDate(truck, 'Camion renvoyé par le gérant') ||
            (truck as any).refusedAt ||
            this.findHistoryDate(truck, 'Refus administrateur') ||
            (truck as any).createdAt ||
            truck.heureArrivee ||
            ''
          );
        }

        if (adv === 'REFUSE_EN_ATTENTE_GERANT') {
          return (
            (truck as any).refusedAt ||
            this.findHistoryDate(truck, 'Refus administrateur') ||
            (truck as any).createdAt ||
            truck.heureArrivee ||
            ''
          );
        }

        return (
          (truck as any).refusedAt ||
          (truck as any).renvoyeAt ||
          this.findHistoryDate(truck, 'Refus administrateur') ||
          this.findHistoryDate(truck, 'Camion renvoyé par le gérant') ||
          (truck as any).createdAt ||
          truck.heureArrivee ||
          ''
        );
      }

      if ((truck as any).advancedStatus === 'ACCEPTE_FINAL') {
        return (
          (truck as any).finalAcceptedAt ||
          this.findHistoryDate(truck, 'Détails produits renseignés — Camion accepté') ||
          (truck as any).createdAt ||
          truck.heureArrivee ||
          ''
        );
      }

      if ((truck as any).advancedStatus === 'REFUSE_REINTEGRE') {
        return (
          (truck as any).reintegratedAt ||
          this.findHistoryDate(truck, 'Réintégration administrateur') ||
          (truck as any).createdAt ||
          truck.heureArrivee ||
          ''
        );
      }

      if (truck.statut === 'Validé') {
        return (
          (truck as any).validatedAt ||
          this.findHistoryDate(truck, 'Validation administrateur') ||
          (truck as any).createdAt ||
          truck.heureArrivee ||
          ''
        );
      }

      if (truck.statut === 'En attente') {
        return (
          this.findHistoryDate(truck, 'Analyses envoyées à l’administrateur') ||
          (truck as any).createdAt ||
          truck.heureArrivee ||
          ''
        );
      }

      return (truck as any).createdAt || truck.heureArrivee || '';
    } catch (e) {
      return (truck as any).createdAt || truck.heureArrivee || '';
    }
  }

  private isInSelectedPeriod(dateIso: string): boolean {
    if (!dateIso) return false;
    const d = new Date(dateIso);
    const now = new Date();

    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentDay = now.getDay() || 7; 
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - (currentDay - 1));

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    if (this.period === 'specific') {
      if (!this.filterDate) return true;
      return d.toDateString() === new Date(this.filterDate).toDateString();
    }

    if (this.period === 'today') {
      return d.toDateString() === now.toDateString();
    }
    if (this.period === 'week') {
      return d >= startOfWeek;
    }
    if (this.period === 'month') {
      return d >= startOfMonth;
    }
    if (this.period === 'year') {
      return d >= startOfYear;
    }

    return true; 
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

  // interprétation UserEntrepot : "Validé" = en cours côté gérant
  get enDechargement(): number {
    return this.filteredTrucks.filter((t) => t.statut === 'Validé' && t.advancedStatus !== 'ACCEPTE_FINAL')
      .length;
  }

  get decharges(): number {
    // Corresponds a l'onglet "Acceptés"
    return this.filteredTrucks.filter((t) => t.advancedStatus === 'ACCEPTE_FINAL').length;
  }

  get annules(): number {
    return this.filteredTrucks.filter((t) => t.statut === 'Annulé').length;
  }

  // "Attente décision admin" : unreadForAdmin (indépendant du statut parfois, mais souvent en cours)
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
