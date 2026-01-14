import { CommonModule } from '@angular/common';
import { Component, OnInit, HostListener, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { TruckService, Truck } from '../services/truck.service';
import { WarehouseService, StoredWarehouse } from '../services/warehouse.service';
import { AuthService } from '../services/auth.service';

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
  selector: 'app-user-dashboard',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './user-dashboard.html',
  styleUrl: './user-dashboard.scss',
})
export class UserDashboard implements OnInit, OnDestroy {
  // session user
  currentUser: StoredUser | null = null;
  userName = '—';
  userRoleLabel = '—';
  userEntrepotId: number | null = null;

  // notifications
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
  }> = [];

  constructor(
    private router: Router,
    private truckService: TruckService,
    private warehouseService: WarehouseService,
    private authService: AuthService
  ) {}

  private pollingInterval: any;

  ngOnInit(): void {
    this.loadCurrentUserOrRedirect();
    this.loadNotifications();
    // Polling toutes les 15 secondes
    this.pollingInterval = setInterval(() => this.loadNotifications(), 15000);
  }

  ngOnDestroy(): void {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
  }

  // -----------------------------
  // Session
  // -----------------------------
  private loadCurrentUserOrRedirect(): void {
    const raw = localStorage.getItem('currentUser');
    if (!raw) {
      this.router.navigate(['/login']);
      return;
    }

    try {
      this.currentUser = JSON.parse(raw) as StoredUser;
    } catch {
      this.currentUser = null;
    }

    if (!this.currentUser || this.currentUser.status !== 'Actif') {
      localStorage.removeItem('currentUser');
      this.router.navigate(['/login']);
      return;
    }

    this.userName = this.currentUser.nom;
    this.userRoleLabel = this.roleLabel(this.currentUser.role);
    this.userEntrepotId = this.currentUser.entrepotId;

    // un user non-admin doit avoir un entrepôt
    if (this.currentUser.role !== 'admin' && this.userEntrepotId === null) {
      localStorage.removeItem('currentUser');
      this.router.navigate(['/login']);
      return;
    }
  }

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

  private roleLabel(role: UserRole): string {
    switch (role) {
      case 'admin':
        return 'Administrateur';
      case 'operator':
        return 'Opérateur';
      case 'driver':
        return 'Chauffeur';
      case 'security':
        return 'Sécurité';
      default:
        return role;
    }
  }

  // -----------------------------
  // Notifications
  // -----------------------------
  loadNotifications(): void {
    if (!this.userEntrepotId) return;

    this.warehouseService.getWarehouses().subscribe({
      next: (warehouses: StoredWarehouse[]) => {
        this.truckService.getTrucks(this.userEntrepotId!).subscribe({
          next: (trucks: Truck[]) => {
            this.notifications = trucks
              .filter((t: Truck) => t.unreadForGerant === true)
              .map((t: Truck) => {
                const wh = warehouses.find((w: StoredWarehouse) => w.id === t.entrepotId);
                return {
                  id: t.id,
                  immatriculation: t.immatriculation,
                  entrepotId: t.entrepotId,
                  entrepotName: wh ? wh.name : 'Inconnu',
                  statut: t.statut,
                };
              });

            this.notifCount = this.notifications.length;
          },
        });
      },
    });
  }

  toggleNotifications(): void {
    this.showNotifDropdown = !this.showNotifDropdown;
  }
  @HostListener('document:click')
  closeNotifDropdownOnOutsideClick(): void {
    if (this.showNotifDropdown) {
      this.showNotifDropdown = false;
    }
  }

  openNotification(n: any): void {
    this.showNotifDropdown = false;

    // Marquer comme lu via l'API
    this.truckService.updateTruck(n.id, { unreadForGerant: false }).subscribe({
      next: () => {
        this.loadNotifications();
        // navigation Angular
        this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
          this.router.navigate(['/userdashboard/userentrepot', n.entrepotId]);
        });
      },
    });
  }
}
