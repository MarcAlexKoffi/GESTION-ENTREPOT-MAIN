import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { WarehouseService, StoredWarehouse } from '../services/warehouse.service';
import { TruckService } from '../services/truck.service';

interface CardInfo {
  id: number;
  imageUrl: string;
  name: string;
  location: string;
  pending: number;
  active: number;
  discharged: number;
  unreadCount: number;
}

// Ce modèle correspond aux camions enregistrés dans localStorage ("trucks")
interface StoredTruck {
  id: number;
  entrepotId: number;
  statut: string;
}

@Component({
  selector: 'app-dashboard-main',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard-main.html',
  styleUrl: './dashboard-main.scss',
})
export class DashboardMain implements OnInit {
  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.selectedImageFile = file;

    const reader = new FileReader();
    reader.onload = () => {
      this.imagePreview = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  // Cartes d'entrepôts
  cards: Array<CardInfo> = [];

  // Modale création / édition
  showWarehouseModal = false;
  
  // Modale suppression
  showDeleteModal = false;
  warehouseToDelete: CardInfo | null = null;

  mode: 'create' | 'edit' = 'create';
  editingWarehouseId: number | null = null;
  selectedImageFile: File | null = null;
  imagePreview: string | null = null;

  // Menu d'actions ⋮
  actionsMenuWarehouseId: number | null = null;

  // Données du formulaire d'entrepôt
  newWarehouse: Partial<CardInfo> = {
    name: '',
    location: '',
    imageUrl: '',
    pending: 0,
    active: 0,
    discharged: 0,
  };

  private router = inject(Router);
  private warehouseService = inject(WarehouseService);
  private truckService = inject(TruckService);

  constructor() {}

  // ---------------------------------------------------------------------------
  // INITIALISATION
  // ---------------------------------------------------------------------------
  ngOnInit(): void {
    this.loadWarehouses();
  }

  loadWarehouses(): void {
    // 1. Charger les entrepôts
    this.warehouseService.getWarehouses().subscribe({
      next: (warehouses: StoredWarehouse[]) => {
        // 2. Charger TOUS les camions pour calculer les stats
        this.truckService.getTrucks().subscribe({
          next: (allTrucks) => {
            this.cards = warehouses.map((w) => {
              let img = w.imageUrl;
              if (img && !img.startsWith('http') && !img.startsWith('data:')) {
                img = `http://localhost:3000${img}`;
              }

              // Filtrer les camions pour cet entrepôt
              const trucksForWarehouse = allTrucks.filter((t) => t.entrepotId === w.id);
              const pending = trucksForWarehouse.filter((t) => t.statut === 'En attente').length;
              const active = trucksForWarehouse.filter(
                (t) => t.statut === 'En cours de déchargement'
              ).length;
              const discharged = trucksForWarehouse.filter((t) => t.statut === 'Déchargé').length;
              const unreadCount = trucksForWarehouse.filter((t) => t.unreadForAdmin).length;

              return {
                id: w.id,
                name: w.name,
                location: w.location,
                imageUrl: img || 'https://via.placeholder.com/800x400?text=Entrepot',
                pending,
                active,
                discharged,
                unreadCount,
              };
            });
          },
          error: (err) => console.error('Erreur chargement camions', err),
        });
      },
      error: (err) => {
        console.error('Erreur chargement entrepôts', err);
      },
    });
  }
  // Ferme le menu ⋮ quand on clique ailleurs sur la page
  @HostListener('document:click')
  closeMenuOnOutsideClick(): void {
    this.actionsMenuWarehouseId = null;
  }

  // ---------------------------------------------------------------------------
  // NAVIGATION VERS LA PAGE DÉTAIL D'UN ENTREPÔT
  // ---------------------------------------------------------------------------
  handleContainerClick(card: CardInfo): void {
    console.warn('CLICKED CARD:', card);
    console.warn(`Navigating to /dashboard/entrepot/${card.id} for ${card.name}`);
    this.router.navigate(['/dashboard/entrepot', card.id]);
  }

  // ---------------------------------------------------------------------------
  // MODALE : OUVERTURE / FERMETURE (MODE CRÉATION PAR DÉFAUT)
  // ---------------------------------------------------------------------------

  openWarehouseModal(): void {
    this.mode = 'create';
    this.editingWarehouseId = null;

    this.newWarehouse = {
      name: '',
      location: '',
      imageUrl: '',
      pending: 0,
      active: 0,
      discharged: 0,
    };

    this.showWarehouseModal = true;
    this.selectedImageFile = null;
    this.imagePreview = null;

    // Reset de l'input file si présent dans le DOM (astuce simple via ID)
    // Pas strictement obligatoire si on recrée le composant, mais ici la modale est toujours là.
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  closeWarehouseModal(): void {
    this.showWarehouseModal = false;
  }

  // ---------------------------------------------------------------------------
  // MENU D'ACTIONS ⋮ SUR LA CARTE
  // ---------------------------------------------------------------------------
  openActionsMenu(card: CardInfo, event: MouseEvent): void {
    event.stopPropagation();

    if (this.actionsMenuWarehouseId === card.id) {
      // Si on clique à nouveau sur le même bouton, on ferme
      this.actionsMenuWarehouseId = null;
    } else {
      this.actionsMenuWarehouseId = card.id;
    }
  }

  // ---------------------------------------------------------------------------
  // MODIFICATION D'UN ENTREPÔT
  // ---------------------------------------------------------------------------
  onEditWarehouse(card: CardInfo): void {
    this.actionsMenuWarehouseId = null;

    this.mode = 'edit';
    this.editingWarehouseId = card.id;

    // Pré-remplir le formulaire avec les données existantes
    this.newWarehouse = {
      name: card.name,
      location: card.location,
      imageUrl: card.imageUrl,
      pending: card.pending,
      active: card.active,
      discharged: card.discharged,
    };

    this.showWarehouseModal = true;
    this.imagePreview = card.imageUrl;
    this.selectedImageFile = null;
  }

  // ---------------------------------------------------------------------------
  // SUPPRESSION D'UN ENTREPÔT + CAMIONS ASSOCIÉS (Option B)
  // ---------------------------------------------------------------------------
  onDeleteWarehouse(card: CardInfo): void {
    this.actionsMenuWarehouseId = null;
    this.warehouseToDelete = card;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.warehouseToDelete = null;
  }

  confirmDelete(): void {
    if (!this.warehouseToDelete) return;
    const card = this.warehouseToDelete;

    // Appel API pour suppression
    this.warehouseService.delete(card.id).subscribe({
      next: () => {
        // 1) Mettre à jour l'affichage
        this.cards = this.cards.filter((w) => w.id !== card.id);
        this.closeDeleteModal();
      },
      error: (err) => {
        console.error('Erreur suppression entrepôt', err);
        alert('Erreur lors de la suppression de l’entrepôt');
        this.closeDeleteModal();
      },
    });
  }

  // ---------------------------------------------------------------------------
  // SAUVEGARDE (CRÉATION OU MODIFICATION)
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // SAUVEGARDE (CRÉATION OU MODIFICATION)
  // ---------------------------------------------------------------------------
  isLoading = false;

  saveWarehouse(): void {
    if (!this.newWarehouse.name || !this.newWarehouse.location) {
      alert('Merci de saisir le nom et la localisation.');
      return;
    }

    this.isLoading = true;

    const payload = {
      name: this.newWarehouse.name as string,
      location: this.newWarehouse.location as string,
      imageFile: this.selectedImageFile || undefined,
    };

    const request$ =
      this.mode === 'create'
        ? this.warehouseService.create(payload)
        : this.warehouseService.update(this.editingWarehouseId!, payload);

    request$.subscribe({
      next: () => {
        this.isLoading = false;
        this.closeWarehouseModal();
        this.loadWarehouses();
        // Feedback visuel simple (pourrait être un toast)
        // alert(this.mode === 'create' ? 'Entrepôt créé avec succès' : 'Modifications enregistrées');
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Erreur saveWarehouse', err);
        const errorMsg = err.error?.message || 'Une erreur est survenue.';
        alert(errorMsg);
      },
    });

    // Reset du formulaire (sera fait à l'ouverture ou ici si besoin)
  }
}
