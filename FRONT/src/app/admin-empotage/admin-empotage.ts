import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { WarehouseService } from '../services/warehouse.service';

interface EmpotageStats {
  total: number;
  today: number;
  week: number;
  month: number;
  year: number;
}

interface EmpotageOperation {
  id: number;
  clientName: string;
  clientInitials: string;
  clientColor: string; // class for background color
  booking: string;
  conteneurs: string;
  volume: number;
  debutPrevu: string;
  finEstimee: string;
  statut: 'En cours' | 'Terminé' | 'A venir' | string;
  entrepotId?: number;
}

@Component({
  selector: 'app-admin-empotage',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-empotage.html',
  styleUrl: './admin-empotage.scss',
})
export class AdminEmpotage implements OnInit {
  private route = inject(ActivatedRoute);
  private warehouseService = inject(WarehouseService);
  
  entrepotId: number = 0;
  entrepotName: string = '';

  stats: EmpotageStats = {
    total: 0,
    today: 0,
    week: 0,
    month: 0,
    year: 0
  };

  filters = {
    client: 'all',
    booking: '',
    dateDebut: '',
    dateFin: ''
  };

  operations: EmpotageOperation[] = [];
  rawOperations: any[] = [];
  loading = false;

  // Pagination
  currentPage = 1;
  pageSize = 10;

  get totalPages(): number {
    return Math.ceil(this.operations.length / this.pageSize) || 1;
  }

  get paginatedOperations(): EmpotageOperation[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.operations.slice(start, start + this.pageSize);
  }

  nextPage() {
     if (this.currentPage < this.totalPages) this.currentPage++;
  }

  prevPage() {
     if (this.currentPage > 1) this.currentPage--;
  }

  async ngOnInit() {
    this.route.params.subscribe(async (params) => {
      this.entrepotId = +params['id'];
      if(this.entrepotId) {
        await this.loadWarehouseInfo();
        await this.loadOperations();
      }
    });
  }

  async loadWarehouseInfo() {
    this.warehouseService.getWarehouse(this.entrepotId).subscribe({
        next: (w) => {
            this.entrepotName = w.name;
        },
        error: (err) => console.error(err)
    });
  }

  async loadOperations() {
    this.loading = true;
    try {
      // Pour l'instant on récupère tout et on filtre côté client
      // Idéalement : /api/empotages?entrepotId=...
      const url = `http://localhost:3000/api/empotages`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      // Filtre uniquement pour cet entrepôt
      this.rawOperations = data.filter((op: any) => op.entrepotId === this.entrepotId);
      
      this.calculateStats();
      this.applyFilters();
    } catch (e) {
      console.error('Erreur chargement empotages admin', e);
    } finally {
      this.loading = false;
    }
  }

  applyFilters() {
    let filtered = [...this.rawOperations];

    // 1. Filtre Booking
    if (this.filters.booking) {
      const search = this.filters.booking.toLowerCase().trim();
      filtered = filtered.filter(op => (op.booking || '').toLowerCase().includes(search));
    }

    // 2. Filtre Client
    if (this.filters.client !== 'all') {
      const filterVal = this.filters.client.toLowerCase();
      filtered = filtered.filter(op => {
        const client = (op.client || '').toLowerCase();
        // Si valeur spécifique comme 'cma' ou 'maersk'
        if (filterVal === 'cma') return client.includes('cma');
        if (filterVal === 'maersk') return client.includes('maersk');
        return client.includes(filterVal);
      });
    }

    // 3. Filtre Période Début
    if (this.filters.dateDebut) {
      const start = new Date(this.filters.dateDebut);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter(op => {
        if (!op.dateStart) return false;
        const d = new Date(op.dateStart);
        return d >= start;
      });
    }

    // 4. Filtre Période Fin
    if (this.filters.dateFin) {
      const end = new Date(this.filters.dateFin);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(op => {
        if (!op.dateStart) return false;
        const d = new Date(op.dateStart);
        return d <= end;
      });
    }

    this.operations = filtered.map(item => this.mapToOperation(item));
    this.currentPage = 1; // Reset pagination
  }

  mapToOperation(item: any): EmpotageOperation {
    const clientName = item.client || 'Inconnu';
    const init = clientName.substring(0, 2).toUpperCase();
    
    // Simple color logic based on first char of initial or length
    const colors = [
      'bg-blue-100 text-blue-600',
      'bg-purple-100 text-purple-600',
      'bg-green-100 text-green-600',
      'bg-orange-100 text-orange-600',
      'bg-pink-100 text-pink-600'
    ];
    const colorIndex = (clientName.length + (item.id || 0)) % colors.length;

    return {
      id: item.id,
      clientName: clientName,
      clientInitials: init,
      clientColor: colors[colorIndex],
      booking: item.booking || '-',
      conteneurs: item.conteneurs ? `${item.conteneurs} Ctr` : '0 Ctr',
      volume: item.volume || 0,
      debutPrevu: item.dateStart ? new Date(item.dateStart).toLocaleString() : '-',
      finEstimee: item.dateEnd ? new Date(item.dateEnd).toLocaleString() : '-',
      statut: item.status || 'A venir',
      entrepotId: item.entrepotId
    };
  }

  calculateStats() {
    const total = this.operations.length;
    
    // Time-based calculations matches user-empotage logic
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const currentDay = now.getDay() || 7; 
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - (currentDay - 1));

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const today = this.operations.filter(op => {
      // Need to rely on raw Date objects if possible, but mapToOperation converted to string format
      // Better to use rawOperations if available or parse back. 
      // Fortunately we stored rawOperations
      // Wait, let's look at raw operations logic below
      return false; 
    }).length; 
    
    // REWRITE using rawOperations for accuracy
    const raw = this.rawOperations;
    
    this.stats = {
      total: raw.length,
      today: raw.filter(e => e.dateStart && new Date(e.dateStart).toDateString() === now.toDateString()).length,
      week: raw.filter(e => e.dateStart && new Date(e.dateStart) >= startOfWeek).length,
      month: raw.filter(e => e.dateStart && new Date(e.dateStart) >= startOfMonth).length,
      year: raw.filter(e => e.dateStart && new Date(e.dateStart) >= startOfYear).length
    };
  }
  printOperation(op: EmpotageOperation) {
    // Implémentation basique de l'impression
    // Vous pourriez vouloir une modale ou une page dédiée
    const printContent = `
      <html>
        <head>
          <title>Impression Opération ${op.booking}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            h1 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>Détails Opération d'Empotage</h1>
          <p><strong>Client:</strong> ${op.clientName}</p>
          <p><strong>Booking:</strong> ${op.booking}</p>
          <p><strong>Statut:</strong> ${op.statut}</p>
          
          <table>
            <tr>
              <th>Conteneurs</th>
              <th>Volume (m³)</th>
              <th>Début Prévu</th>
              <th>Fin Estimée</th>
            </tr>
            <tr>
              <td>${op.conteneurs}</td>
              <td>${op.volume}</td>
              <td>${op.debutPrevu}</td>
              <td>${op.finEstimee}</td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const popupWin = window.open('', '_blank', 'width=600,height=600');
    if (popupWin) {
      popupWin.document.open();
      popupWin.document.write(printContent);
      popupWin.document.close();
      popupWin.print();
    }
  }
  getStatusClass(statut: string): string {
    switch (statut) {
      case 'En cours': return 'status-pill--enregistre';
      case 'Terminé': return 'status-pill--validated';
      case 'A venir': 
      case 'Prévu': return 'status-pill--pending';
      default: return 'status-pill--pending';
    }
  }

  getStatusIcon(statut: string): string {
    switch (statut) {
      case 'En cours': return 'sync'; 
      case 'Terminé': return 'check_circle';
      case 'A venir': 
      case 'Prévu': return 'schedule';
      default: return 'help';
    }
  }

  resetFilters() {
    this.filters = {
      client: 'all',
      booking: '',
      dateDebut: '',
      dateFin: ''
    };
    this.applyFilters();
  }
}
