import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { WarehouseService } from '../services/warehouse.service';
import { ToastService } from '../services/toast.service';
import { environment } from '../config';
import { firstValueFrom } from 'rxjs';

interface EmpotageContainer {
  id?: number;
  empotageId?: number;
  numeroConteneur: string;
  nombreSacs: number;
  volume: number;
  poids: number;
  createdAt?: string;
}

interface Empotage {
  id?: number;
  client: string;
  clientType?: string;
  booking: string;
  conteneurs: number;
  volume: number;
  dateStart: string;
  dateEnd: string | null;
  status: 'En attente' | 'Terminé';
  entrepotId?: number;
  containers?: EmpotageContainer[];
}

interface EmpotageStats {
  total: number;
  today: number;
  week: number;
  month: number;
  year: number;
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
  private http = inject(HttpClient);
  private toastService = inject(ToastService);
  
  entrepotId: number = 0;
  entrepotName: string = '';

  stats: EmpotageStats = {
    total: 0,
    today: 0,
    week: 0,
    month: 0,
    year: 0
  };

  // Harmonized filters
  search: string = '';
  period: 'today' | 'week' | 'month' | 'year' | 'specific' = 'today';
  filterDate: string = '';

  paginatedEmpotages: Empotage[] = [];
  rawEmpotages: Empotage[] = [];
  filteredEmpotages: Empotage[] = [];
  loading = false;

  // Pagination
  currentPage = 1;
  pageSize = 10;

  get totalPages(): number {
    return Math.ceil(this.filteredEmpotages.length / this.pageSize) || 1;
  }

  // Modals
  showHistoryModal = false;
  selectedBookingHistory: Empotage | null = null;
  
  showDeleteModal = false;
  itemToDelete: Empotage | null = null;

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
      let url = `${environment.apiUrl}/empotages`;
      if (this.entrepotId) {
        url += `?entrepotId=${this.entrepotId}`;
      }
      
      const data = await firstValueFrom(this.http.get<Empotage[]>(url));
      this.rawEmpotages = data.sort((a, b) => new Date(b.dateStart).getTime() - new Date(a.dateStart).getTime());
      
      this.calculateStats();
      this.applyFilters();
    } catch (e) {
      console.error('Erreur chargement empotages admin', e);
    } finally {
      this.loading = false;
    }
  }

  setPeriod(p: 'today' | 'week' | 'month' | 'year' | 'specific') {
    this.period = p;
    if (p !== 'specific') this.filterDate = '';
    this.applyFilters();
  }

  onDateChange() {
    if (this.filterDate) this.setPeriod('specific');
    else this.setPeriod('today');
  }

  applyFilters() {
    let filtered = [...this.rawEmpotages];

    // 1. Filtre Global (Booking/Client)
    if (this.search) {
      const s = this.search.toLowerCase().trim();
      filtered = filtered.filter(op => 
        (op.booking || '').toLowerCase().includes(s) || 
        (op.client || '').toLowerCase().includes(s)
      );
    }

    // 2. Filtre Période (Start Date)
    filtered = filtered.filter(op => this.isInSelectedPeriod(op.dateStart));

    this.filteredEmpotages = filtered;
    this.currentPage = 1; 
    this.updatePagination();
  }

  updatePagination() {
    const start = (this.currentPage - 1) * this.pageSize;
    this.paginatedEmpotages = this.filteredEmpotages.slice(start, start + this.pageSize);
  }

  nextPage() {
     if (this.currentPage < this.totalPages) {
       this.currentPage++;
       this.updatePagination();
     }
  }

  prevPage() {
     if (this.currentPage > 1) {
       this.currentPage--;
       this.updatePagination();
     }
  }

  private isInSelectedPeriod(dateIso?: string): boolean {
    if (!dateIso) return false;
    const created = new Date(dateIso);
    const now = new Date();

    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentDay = now.getDay() || 7;
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - (currentDay - 1));

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    if (this.period === 'specific' && this.filterDate) {
       const d = new Date(dateIso);
       const year = d.getFullYear();
       const month = String(d.getMonth() + 1).padStart(2, '0');
       const day = String(d.getDate()).padStart(2, '0');
       const dateStr = `${year}-${month}-${day}`;
       return dateStr === this.filterDate;
    }

    if (this.period === 'today') {
      return created.toDateString() === now.toDateString();
    }
    if (this.period === 'week') {
      return created >= startOfWeek;
    }
    if (this.period === 'month') {
      return created >= startOfMonth;
    }
    if (this.period === 'year') {
      return created >= startOfYear;
    }

    return true;
  }

  calculateStats() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const currentDay = now.getDay() || 7; 
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - (currentDay - 1));

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const raw = this.rawEmpotages;
    
    this.stats = {
      total: raw.length,
      today: raw.filter(e => e.dateStart && new Date(e.dateStart).toDateString() === now.toDateString()).length,
      week: raw.filter(e => e.dateStart && new Date(e.dateStart) >= startOfWeek).length,
      month: raw.filter(e => e.dateStart && new Date(e.dateStart) >= startOfMonth).length,
      year: raw.filter(e => e.dateStart && new Date(e.dateStart) >= startOfYear).length
    };
  }

  async exportAllCsv() {
      // Export filtered empotages
      const rows = [
          ['Client', 'Booking', 'Conteneurs', 'Volume', 'Date Début', 'Date Fin', 'Statut']
      ];

      this.filteredEmpotages.forEach(e => {
          rows.push([
              e.client || '',
              e.booking || '',
              e.conteneurs.toString(),
              e.volume.toFixed(2).replace('.', ','), // French format often prefers comma
              e.dateStart ? new Date(e.dateStart).toLocaleDateString() + ' ' + new Date(e.dateStart).toLocaleTimeString() : '',
              e.dateEnd ? new Date(e.dateEnd).toLocaleDateString() + ' ' + new Date(e.dateEnd).toLocaleTimeString() : '',
              e.status
          ]);
      });

      const csvContent = rows.map(e => e.map(cell => {
          const stringCell = String(cell);
          return `"${stringCell.replace(/"/g, '""')}"`;
      }).join(";")).join("\r\n"); // Windows EOL

      // Add BOM for Excel UTF-8 recognition
      const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `empotages_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  }

  // HISTORY
  async openHistory(item: Empotage) {
    if(!item.id) return;
    this.selectedBookingHistory = item;
    // Load details (containers)
    try {
       const fullData = await firstValueFrom(this.http.get<Empotage>(`${environment.apiUrl}/empotages/${item.id}`));
       this.selectedBookingHistory.containers = fullData.containers;
       this.showHistoryModal = true;
    } catch(e) {
       console.error(e);
    }
  }

  closeHistoryModal() {
    this.showHistoryModal = false;
    this.selectedBookingHistory = null;
  }

  exportHistoryCsv() {
    if (!this.selectedBookingHistory || !this.selectedBookingHistory.id) return;
    window.location.href = `${environment.apiUrl}/empotages/${this.selectedBookingHistory.id}/export`;
  }
  
  // DELETE
  deleteEmpotage(item: Empotage) {
    this.itemToDelete = item;
    this.showDeleteModal = true;
  }

  cancelDelete() {
    this.showDeleteModal = false;
    this.itemToDelete = null;
  }

  async confirmDelete() {
    if (!this.itemToDelete || !this.itemToDelete.id) return;

    try {
        await firstValueFrom(this.http.delete(`${environment.apiUrl}/empotages/${this.itemToDelete.id}`));
        
        // Remove from list
        this.rawEmpotages = this.rawEmpotages.filter(e => e.id !== this.itemToDelete!.id);
        this.applyFilters();
        this.calculateStats();
        
        this.showDeleteModal = false;
        this.itemToDelete = null;
        this.toastService.success('Empotage supprimé');
    } catch(e) {
        console.error(e);
        this.toastService.error("Erreur lors de la suppression");
    }
  }

  printOperation(op: Empotage) {
    if (!op) return;

    const popupWin = window.open('', '_blank', 'width=1000,height=800,top=50,left=50');
    if (!popupWin) {
      this.toastService.warning("La fenêtre d'impression a été bloquée. Veuillez autoriser les popups.");
      return;
    }

    const containersHtml = op.containers?.map(c => `
      <tr>
        <td>${c.numeroConteneur}</td>
        <td>${c.nombreSacs}</td>
        <td>${c.volume} m³</td>
        <td>${c.poids} kg</td>
      </tr>
    `).join('') || '<tr><td colspan="4" style="text-align:center;">Aucun conteneur</td></tr>';

    const content = `
      <html>
        <head>
          <title>Impression Empotage - ${op.booking}</title>
          <style>
             body { font-family: sans-serif; padding: 40px; color: #333; }
             .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
             h1 { margin: 0; font-size: 24px; }
             .meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 30px; }
             .meta-item { display: flex; flex-direction: column; }
             .label { font-weight: bold; font-size: 12px; text-transform: uppercase; color: #666; }
             .value { font-size: 16px; margin-top: 4px; }
             table { width: 100%; border-collapse: collapse; margin-top: 20px; }
             th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
             th { background-color: #f5f5f5; font-weight: bold; }
             .footer { margin-top: 50px; font-size: 12px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Bon d'Empotage</h1>
            <div style="text-align: right;">
               <div style="font-size: 14px; font-weight: bold;">${new Date().toLocaleDateString()}</div>
            </div>
          </div>
          
          <div class="meta">
            <div class="meta-item">
              <span class="label">Booking</span>
              <span class="value">${op.booking}</span>
            </div>
            <div class="meta-item">
              <span class="label">Client</span>
              <span class="value">${op.client}</span>
            </div>
             <div class="meta-item">
              <span class="label">Date Début</span>
              <span class="value">${new Date(op.dateStart).toLocaleDateString()} ${new Date(op.dateStart).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
            <div class="meta-item">
              <span class="label">Statut</span>
              <span class="value">${op.status}</span>
            </div>
            <div class="meta-item">
              <span class="label">Total Conteneurs</span>
              <span class="value">${op.conteneurs}</span>
            </div>
            <div class="meta-item">
              <span class="label">Volume Total</span>
              <span class="value">${op.volume} m³</span>
            </div>
          </div>

          <h3>Liste des Conteneurs</h3>
          <table>
            <thead>
              <tr>
                <th>N° Conteneur</th>
                <th>Sacs</th>
                <th>Volume</th>
                <th>Poids</th>
              </tr>
            </thead>
            <tbody>
              ${containersHtml}
            </tbody>
          </table>

          <div class="footer">
             Généré automatiquement par le système de Gestion Entrepôt
          </div>

          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;

    popupWin.document.open();
    popupWin.document.write(content);
    popupWin.document.close();
  }
}
