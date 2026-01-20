import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { WarehouseService } from '../services/warehouse.service';

interface WarehouseUI {
  id: number;
  name: string;
  code: string;
  location: string;
  status: 'ACTIF' | 'SATURÉ' | 'MAINTENANCE' | 'INACTIF';
  imageUrl: string;
  todayCount: number;
}
import { environment } from '../config';
@Component({
  selector: 'app-admin-empotage-main',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-empotage-main.html',
  styleUrl: './admin-empotage-main.scss',
})
export class AdminEmpotageMain implements OnInit {
  private warehouseService = inject(WarehouseService);
  private router = inject(Router);

  searchTerm = '';
  warehouses: WarehouseUI[] = [];

  ngOnInit() {
    this.loadWarehouses();
  }

  async loadWarehouses() {
    try {
        // 1. Get Warehouses
        const warehousesData = await new Promise<any[]>((resolve, reject) => {
            this.warehouseService.getWarehouses().subscribe({next: resolve, error: reject});
        });

        // 2. Get All Empotages (to calculate stats)
        const res = await fetch(`${environment.apiUrl}/empotages`);
        const allEmpotages = await res.json();
        const now = new Date();
        const todayStr = now.toDateString();

        this.warehouses = warehousesData.map((w) => {
            // Count today's empotages for this warehouse
            const count = allEmpotages.filter((e: any) => {
                if(!e.entrepotId || e.entrepotId !== w.id) return false;
                if(!e.dateStart) return false;
                return new Date(e.dateStart).toDateString() === todayStr;
            }).length;

            return {
                id: w.id,
                name: w.name,
                location: w.location,
                code: this.generateCode(w.name, w.id),
                status: count > 0 ? 'ACTIF' : 'INACTIF',
                imageUrl: this.fixImageUrl(w.imageUrl),
                todayCount: count
            };
        });

    } catch (err) {
      console.error('Erreur lors du chargement des données', err);
    }
  }

  selectWarehouse(id: number) {
    this.router.navigate(['/dashboard', 'adminEmpotage', id]);
  }

  private fixImageUrl(url: string): string {
    if (!url || url.includes('800x400?text=Entrepot')) {
        return '/assets/placeholder-warehouse.png';
    }
    
    if (url.startsWith('http') || url.startsWith('https') || url.startsWith('data:')) {
        return url;
    }
    
    const baseUrl = environment.apiUrl.replace('/api', '');
    return url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/${url}`;
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
        return 'status-pill status-pill--validated';
      case 'SATURÉ':
        return 'status-pill status-pill--pending';
      case 'MAINTENANCE':
        return 'status-pill status-pill--renvoye';
      default:
        return 'status-pill status-pill--renvoye';
    }
  }
}
