import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { TruckService, Truck } from '../services/truck.service';
import { WarehouseService, StoredWarehouse } from '../services/warehouse.service';
import { AuthService } from '../services/auth.service';
import { filter } from 'rxjs/operators';
import { environment } from '../config';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit, OnDestroy {
  // Mobile Sidebar State
  isSidebarOpen = false;

  // ===============================================================
  // NOTIFICATIONS
  // ===============================================================
  notifCount = 0;
  showNotifDropdown = false;
  
  // Logout confirmation
  showLogoutConfirm = false;

  notifications: Array<{
    id: number;
    title: string;
    subtitle: string;
    time: string;
    type: 'truck' | 'empotage';
    sourceId: number;
    original?: any;
  }> = [];

  // User Info
  userName = 'Marc Alex';
  userRoleLabel = 'Administrateur';

  constructor(
    private router: Router,
    private truckService: TruckService,
    private warehouseService: WarehouseService,
    private authService: AuthService
  ) {}

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeSidebar() {
    this.isSidebarOpen = false;
  }

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
    this.loadCurrentUser();
    this.loadNotifications();
    // Polling toutes les 15 secondes
    this.pollingInterval = setInterval(() => this.loadNotifications(), 15000);

    // Close sidebar on route change (mobile)
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.closeSidebar();
    });
  }

  loadCurrentUser() {
      const raw = sessionStorage.getItem('currentUser');
      if (raw) {
          try {
              const u = JSON.parse(raw);
              this.userName = u.nom || 'Administrateur';
              this.userRoleLabel = u.role === 'admin' ? 'Administrateur' : (u.role || 'Admin');
          } catch(e) {}
      }
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
            // 1. Truck Notifications
            const truckNotifs = trucks
              .filter((t: Truck) => t.statut === 'En attente' || t.unreadForAdmin === true)
              .map((t: Truck) => {
                const wh = warehouses.find((w: StoredWarehouse) => w.id === t.entrepotId);
                return {
                  id: t.id,
                  title: t.immatriculation,
                  subtitle: wh ? wh.name : 'Entrepôt inconnu',
                  time: t.heureArrivee,
                  type: 'truck' as const,
                  sourceId: t.id,
                  original: t
                };
              });
            
            // 2. Empotage Notifications
            fetch(`${environment.apiUrl}/notifications`)
                .then(r => r.json())
                .then((apiNotifs: any[]) => {
                    const empotageNotifs = apiNotifs.map((n: any) => ({
                         id: n.id,
                         title: 'Empotage',
                         subtitle: n.message,
                         time: n.createdAt,
                         type: 'empotage' as const,
                         sourceId: n.id,
                         original: n
                    }));
                    
                    // Merge & Sort
                    this.notifications = [...truckNotifs, ...empotageNotifs]
                        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

                    this.notifCount = this.notifications.length;
                })
                .catch(err => {
                    console.error('Error fetching notifications', err);
                    // Fallback to just trucks if error
                    this.notifications = truckNotifs;
                    this.notifCount = this.notifications.length;
                });
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

    if (n.type === 'truck') {
        // On marque cette notification comme lue via l'API
        this.truckService.updateTruck(n.sourceId, { unreadForAdmin: false }).subscribe({
          next: () => {
            this.loadNotifications();
            // Navigation vers l'entrepôt concerné
            this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
              this.router.navigate(['/dashboard/entrepot', n.original.entrepotId]);
            });
          },
        });
    } else if (n.type === 'empotage') {
        // Mark as read
        fetch(`${environment.apiUrl}/notifications/${n.sourceId}/read`, { method: 'PUT' })
             .then(() => {
                 this.loadNotifications();
                 this.router.navigate(['/dashboard/adminEmpotageMain']);
             });
    }
  }
}
