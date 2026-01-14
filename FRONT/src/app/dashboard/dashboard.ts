import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { TruckService, Truck } from '../services/truck.service';
import { WarehouseService, StoredWarehouse } from '../services/warehouse.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit, OnDestroy {
  // ===============================================================
  // NOTIFICATIONS
  // ===============================================================
  notifCount = 0;
  showNotifDropdown = false;
  
  // Logout confirmation
  showLogoutConfirm = false;

  notifications: Array<{
    id: number;
    immatriculation: string;
    entrepotId: number;
    entrepotName: string;
    statut: string;
    advancedStatus?: string;
    heureArrivee: string;
  }> = [];

  constructor(
    private router: Router,
    private truckService: TruckService,
    private warehouseService: WarehouseService,
    private authService: AuthService
  ) {}

  // ===============================================================
  // SESSION: Déconnexion
  // ===============================================================
  requestLogout(): void {
    this.showLogoutConfirm = true;
  }

  cancelLogout(): void {
    this.showLogoutConfirm = false;
  }

  logout(): void {
    this.showLogoutConfirm = false;
    this.authService.logout();
  }

  private pollingInterval: any;

  ngOnInit(): void {
    this.loadNotifications();
    // Polling toutes les 15 secondes
    this.pollingInterval = setInterval(() => this.loadNotifications(), 15000);
  }

  ngOnDestroy(): void {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
  }

  // ===============================================================
  // CHARGEMENT DES NOTIFICATIONS
  // ===============================================================
  loadNotifications() {
    this.warehouseService.getWarehouses().subscribe({
      next: (warehouses: StoredWarehouse[]) => {
        this.truckService.getTrucks().subscribe({
          next: (trucks: Truck[]) => {
            // On charge :
            // Tous les camions "En attente" (analyses envoyées)
            // Tous les camions renvoyés vers l'admin (unreadForAdmin = true)
            this.notifications = trucks
              .filter((t: Truck) => t.statut === 'En attente' || t.unreadForAdmin === true)
              .map((t: Truck) => {
                const wh = warehouses.find((w: StoredWarehouse) => w.id === t.entrepotId);
                return {
                  id: t.id,
                  immatriculation: t.immatriculation,
                  entrepotId: t.entrepotId,
                  entrepotName: wh ? wh.name : 'Entrepôt inconnu',
                  statut: t.statut,
                  advancedStatus: t.advancedStatus,
                  heureArrivee: t.heureArrivee,
                };
              });

            // Nombre affiché sur le badge
            this.notifCount = this.notifications.length;
          },
        });
      },
    });
  }

  // ===============================================================
  // OUVERTURE / FERMETURE DU DROPDOWN
  // ===============================================================
  toggleNotifications(event: MouseEvent) {
    event.stopPropagation(); // empêche la fermeture immédiate
    this.showNotifDropdown = !this.showNotifDropdown;
  }

  @HostListener('document:click')
  closeNotifOnOutsideClick(): void {
    this.showNotifDropdown = false;
  }

  @HostListener('document:keydown.escape')
  closeNotifOnEscape(): void {
    this.showNotifDropdown = false;
  }

  // ===============================================================
  // QUAND L'ADMIN CLIQUE SUR UNE NOTIFICATION
  // ===============================================================
  openNotification(n: any) {
    // On ferme le dropdown
    this.showNotifDropdown = false;

    // On marque cette notification comme lue via l'API
    this.truckService.updateTruck(n.id, { unreadForAdmin: false }).subscribe({
      next: () => {
        // Recharger les notifications (mise à jour du badge)
        this.loadNotifications();

        // Navigation vers l'entrepôt concerné
        this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
          this.router.navigate(['/dashboard/entrepot', n.entrepotId]);
        });
      },
    });
  }
}
