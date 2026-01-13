import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { WarehouseService } from '../services/warehouse.service';

interface WarehouseUI {
  id: number;
  name: string;
  code: string;
  location: string;
  status: 'ACTIF' | 'SATURÉ' | 'MAINTENANCE';
  imageUrl: string;
}

@Component({
  selector: 'app-admin-empotage-main',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-empotage-main.html',
  styleUrl: './admin-empotage-main.scss',
})
export class AdminEmpotageMain implements OnInit {
  private warehouseService = inject(WarehouseService);

  searchTerm = '';
  warehouses: WarehouseUI[] = [];

  ngOnInit() {
    this.loadWarehouses();
  }

  loadWarehouses() {
    this.warehouseService.getWarehouses().subscribe({
      next: (data) => {
        this.warehouses = data.map((w) => ({
          id: w.id,
          name: w.name,
          location: w.location,
          // Génération d'un code fictif basé sur le nom
          code: this.generateCode(w.name, w.id),
          // Statut par défaut (Actif) car non présent en DB
          status: 'ACTIF',
          imageUrl: this.fixImageUrl(w.imageUrl),
        }));
      },
      error: (err) => {
        console.error('Erreur lors du chargement des entrepôts', err);
      },
    });
  }

  private fixImageUrl(url: string): string {
    if (!url) return ''; // Le CSS gérera le fallback couleur
    if (url.startsWith('http')) return url;
    // On suppose que le backend est sur le port 3000
    return `http://localhost:3000${url}`;
  }

  private generateCode(name: string, id: number): string {
    // Ex: "Entrepôt Abidjan" -> "E-A-01"
    const initials = name
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase())
      .filter((char) => /[A-Z0-9]/.test(char))
      .slice(0, 3)
      .join('-');
    const idStr = id.toString().padStart(2, '0');
    return `${initials}-${idStr}`;
  }

  get filteredWarehouses() {
    return this.warehouses.filter(
      (w) =>
        w.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        w.code.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  getStatusClass(status: string) {
    switch (status) {
      case 'ACTIF':
        return 'badge-active';
      case 'SATURÉ':
        return 'badge-warning';
      case 'MAINTENANCE':
        return 'badge-neutral';
      default:
        return '';
    }
  }
}
