import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserService, User } from '../services/user.service';
import { WarehouseService, StoredWarehouse } from '../services/warehouse.service';

@Component({
  selector: 'app-users-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users-manager.html',
  styleUrl: './users-manager.scss',
})
export class UsersManager implements OnInit {
  // --- data
  users: User[] = [];
  warehouses: StoredWarehouse[] = [];

  // --- filters
  searchTerm = '';
  selectedRole: '' | 'admin' | 'operator' = '';
  selectedWarehouseId: '' | number = '';

  // --- modal create/edit
  showUserModal = false;
  isEditMode = false;

  formUser: Partial<User> = this.getEmptyFormUser();

  // --- UI message simple
  toastMessage: string | null = null;
  isLoading = false;

  constructor(private userService: UserService, private warehouseService: WarehouseService) {}

  ngOnInit(): void {
    this.loadWarehouses();
    this.loadUsers();
  }

  // ---------------------------
  // Chargement
  // ---------------------------
  private loadWarehouses(): void {
    this.warehouseService.getWarehouses().subscribe({
      next: (data) => (this.warehouses = data),
      error: (err) => console.error('Erreur chargement entrepôts', err),
    });
  }

  private loadUsers(): void {
    this.userService.getUsers().subscribe({
      next: (data) => (this.users = data),
      error: (err) => console.error('Erreur chargement utilisateurs', err),
    });
  }

  // ---------------------------
  // Helpers affichage
  // ---------------------------
  get filteredUsers(): User[] {
    const search = this.searchTerm.trim().toLowerCase();

    return this.users.filter((u) => {
      if (search) {
        const haystack = `${u.nom} ${u.username}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      if (this.selectedRole) {
        if (u.role !== this.selectedRole) return false;
      }

      if (this.selectedWarehouseId !== '') {
        const wid = Number(this.selectedWarehouseId);
        if (u.entrepotId !== wid) return false;
      }

      return true;
    });
  }

  getWarehouseName(entrepotId: number | null): string {
    if (entrepotId === null) return '—';
    // On essaie de trouver dans la liste chargée, sinon on prend le nom joint par l'API
    const found = this.warehouses.find((w) => w.id === entrepotId);
    if (found) return found.name;

    // Fallback: chercher dans le user si l'API renvoie le nom (jointure)
    const user = this.users.find((u) => u.entrepotId === entrepotId);
    return user?.entrepotName ?? '—';
  }

  getInitials(nom: string): string {
    const parts = nom.trim().split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? '';
    const second = parts.length > 1 ? parts[1][0] : parts[0]?.[1] ?? '';
    return (first + second).toUpperCase();
  }

  roleLabel(role: string): string {
    switch (role) {
      case 'admin':
        return 'Administrateur';
      case 'operator':
        return 'Opérateur';
      default:
        return role;
    }
  }

  roleIcon(role: string): string {
    switch (role) {
      case 'admin':
        return 'shield_person';
      case 'operator':
        return 'desktop_windows';
      default:
        return 'person';
    }
  }

  statusClass(status: string): string {
    switch (status) {
      case 'Actif':
        return 'status-pill status-pill--validated';
      case 'Inactif':
        return 'status-pill status-pill--refoule';
      case 'En attente':
        return 'status-pill status-pill--pending';
      default:
        return 'status-pill status-pill--validated';
    }
  }

  statusIcon(status: string): string {
    switch (status) {
      case 'Actif':
        return 'check_circle';
      case 'Inactif':
        return 'cancel';
      case 'En attente':
        return 'hourglass_empty';
      default:
        return 'help_outline';
    }
  }

  // ---------------------------
  // Modal create/edit
  // ---------------------------
  openCreateUser(): void {
    this.isEditMode = false;
    this.formUser = this.getEmptyFormUser();
    // par défaut, on choisit le 1er entrepôt si disponible
    if (this.warehouses.length > 0) {
      this.formUser.entrepotId = this.warehouses[0].id;
    }
    this.showUserModal = true;
  }

  openEditUser(user: User): void {
    this.isEditMode = true;
    this.formUser = { ...user, password: '' }; // On ne préremplit pas le mot de passe
    this.showUserModal = true;
  }

  closeUserModal(): void {
    this.showUserModal = false;
  }

  saveUserFromModal(): void {
    if (!this.formUser.nom || !this.formUser.username || !this.formUser.role) {
      this.showToast('Veuillez remplir les champs obligatoires.');
      return;
    }

    // Role validation
    if (this.formUser.role === 'operator' && !this.formUser.entrepotId) {
      // Check if warehouses exist
      if (this.warehouses.length === 0) {
        this.showToast("Aucun entrepôt disponible. Créez d'abord un entrepôt.");
        return;
      }
      this.showToast('Un opérateur doit être lié à un entrepôt.');
      return;
    }

    // Si admin, entrepotId null de force
    if (this.formUser.role === 'admin') {
      this.formUser.entrepotId = null;
    }

    this.isLoading = true;
    const observer = {
      next: () => {
        this.isLoading = false;
        this.showToast(this.isEditMode ? 'Utilisateur mis à jour.' : 'Utilisateur créé.');
        this.closeUserModal();
        this.loadUsers();
      },
      error: (err: any) => {
        this.isLoading = false;
        console.error(err);
        const msg = err.error?.message || 'Une erreur est survenue';
        this.showToast(msg);
      },
    };

    if (this.isEditMode && this.formUser.id) {
      this.userService.updateUser(this.formUser.id, this.formUser).subscribe(observer);
    } else {
      if (!this.formUser.password) {
        this.isLoading = false;
        this.showToast('Mot de passe requis pour la création.');
        return;
      }
      this.userService.createUser(this.formUser as User).subscribe(observer);
    }
  }

  deleteUser(user: User): void {
    // empêcher de supprimer le dernier admin
    if (user.role === 'admin') {
      const admins = this.users.filter((u) => u.role === 'admin');
      if (admins.length <= 1) {
        this.showToast('Impossible : il doit rester au moins un administrateur.');
        return;
      }
    }

    const ok = confirm(`Supprimer l'utilisateur "${user.nom}" ?`);
    if (!ok) return;

    this.userService.deleteUser(user.id!).subscribe({
      next: () => {
        this.showToast('Utilisateur supprimé.');
        this.loadUsers();
      },
      error: (err) => {
        this.showToast('Erreur suppression.');
        console.error(err);
      },
    });
  }

  // modification rapide de l'entrepôt depuis le select dans le tableau
  updateUserWarehouse(user: User, entrepotIdValue: string | number | null): void {
    const entrepotId = entrepotIdValue ? Number(entrepotIdValue) : null;

    // Si on veut mettre à jour juste l'entrepôt
    this.userService.updateUser(user.id!, { entrepotId }).subscribe({
      next: () => {
        user.entrepotId = entrepotId;
        this.showToast('Entrepôt affecté.');
      },
      error: (err) => this.showToast('Erreur mise à jour.'),
    });
  }

  // ---------------------------
  // Private helpers
  // ---------------------------
  private getEmptyFormUser(): Partial<User> {
    return {
      nom: '',
      username: '',
      password: '',
      role: 'operator',
      entrepotId: null,
      status: 'Actif',
    };
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    setTimeout(() => {
      this.toastMessage = null;
    }, 2500);
  }
}
