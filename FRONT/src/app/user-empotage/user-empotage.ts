import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { WarehouseService } from '../services/warehouse.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../config';

interface Empotage {
  id?: number;
  client: string;
  booking: string;
  conteneurs: number;
  volume: number;
  dateStart: string;
  dateEnd: string;
  status: 'A venir' | 'En cours' | 'Terminé';
  entrepotId?: number; // Added to sync with Admin
}

@Component({
  selector: 'app-user-empotage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-empotage.html',
  styleUrl: './user-empotage.scss',
})
export class UserEmpotage implements OnInit {
  private warehouseService = inject(WarehouseService);
  private authService = inject(AuthService);
  private http = inject(HttpClient);
  
  warehouses: any[] = []; // List to select from

  stats = {
    total: 0,
    today: 0,
    week: 0,
    month: 0,
    year: 0
  };

  empotages: Empotage[] = [];
  
  // UI state
  search: string = '';
  filterDate: string = '';
  period: 'today' | 'week' | 'month' | 'year' | 'specific' = 'today';
  loading = false;
  selectedWarehouseId: number | null = null;
  
  // Modal state
  showCreateModal = false;
  saving = false;
  isEditing = false;
  currentId: number | null = null;
  errorMessage: string = '';
  
  // Delete Modal State
  showDeleteModal = false;
  itemToDelete: Empotage | null = null;
  
  // Pagination
  currentPage = 1;
  pageSize = 10;

  get totalPages(): number {
    return Math.ceil(this.filteredEmpotages.length / this.pageSize) || 1;
  }

  get paginatedEmpotages(): Empotage[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredEmpotages.slice(start, start + this.pageSize);
  }

  nextPage() {
     if (this.currentPage < this.totalPages) this.currentPage++;
  }

  prevPage() {
     if (this.currentPage > 1) this.currentPage--;
  }

  newEmpotage: Empotage = {
    client: '',
    booking: '',
    conteneurs: 1,
    volume: 0,
    dateStart: '',
    dateEnd: '',
    status: 'A venir',
    entrepotId: undefined
  };
  
  // ... (computed filteredEmpotages and other methods remain same)

  // --- Server integration ---
  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user && user.entrepotId) {
      this.selectedWarehouseId = user.entrepotId;
    }
    this.loadWarehouses();
  }

  loadWarehouses() {
    this.warehouseService.getWarehouses().subscribe({
        next: (res) => {
          this.warehouses = res;
          if (this.warehouses.length > 0 && !this.selectedWarehouseId) {
            this.selectedWarehouseId = this.warehouses[0].id;
            this.loadEmpotages();
          } else if (this.selectedWarehouseId) {
            this.loadEmpotages();
          }
        },
        error: (err) => console.error('Erreur loading warehouses', err)
    });
  }

  async loadEmpotages() {
    if (!this.selectedWarehouseId) return;
    this.loading = true;
    try {
      const url = `${environment.apiUrl}/empotages?entrepotId=${this.selectedWarehouseId}`;
      const data = await firstValueFrom(this.http.get<Empotage[]>(url));
      this.empotages = data;
      this.calculateStats();
      this.currentPage = 1; // RESET PAGE on load
    } catch (e) {
      console.error('Erreur chargement empotages', e);
      // alert('Erreur chargement empotages (voir console)');
    } finally {
      this.loading = false;
    }
  }

  calculateStats() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Calculate start of week (Monday)
    const currentDay = now.getDay() || 7; // Sunday is 0, make it 7
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - (currentDay - 1));

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const list = this.filteredEmpotages;

    this.stats = {
      total: list.length,
      today: list.filter(e => {
        if (!e.dateStart) return false;
        const d = new Date(e.dateStart);
        // On compare strictement la date du jour (ignorer l'heure pour le jour courant)
        return d.toDateString() === now.toDateString();
      }).length,
      week: list.filter(e => {
        if (!e.dateStart) return false;
        const d = new Date(e.dateStart);
        return d >= startOfWeek;
      }).length,
      month: list.filter(e => {
        if (!e.dateStart) return false;
        const d = new Date(e.dateStart);
        return d >= startOfMonth;
      }).length,
      year: list.filter(e => {
        if (!e.dateStart) return false;
        const d = new Date(e.dateStart);
        return d >= startOfYear;
      }).length
    };
  }

  // Trigger server-side CSV download
  exportCsvServer() {
    const params = new URLSearchParams();
    if (this.search) params.append('q', this.search);
    window.location.href = `${environment.apiUrl}/empotages/export?${params.toString()}`;
  }

  openCreateModal() {
    this.isEditing = false;
    this.currentId = null;
    this.showCreateModal = true;
    this.errorMessage = '';
    // reset
    this.newEmpotage = {
      client: '', booking: '', conteneurs: 1, volume: 0, dateStart: '', dateEnd: '', status: 'A venir',
      entrepotId: this.selectedWarehouseId || undefined
    };
  }
  get filteredEmpotages(): Empotage[] {
    const q = this.search.trim().toLowerCase();
    return this.empotages.filter(item => {
      // 1. Filter by Period
      if (!this.isInSelectedPeriod(item.dateStart)) return false;
      
      // 2. Filter by search query
      if (!q) return true;
      return (
        (item.client || '').toLowerCase().includes(q) ||
        (item.booking || '').toLowerCase().includes(q)
      );
    });
  }

  setPeriod(p: 'today' | 'week' | 'month' | 'year' | 'specific') {
    this.period = p;
    if (p !== 'specific') this.filterDate = '';
    this.onFiltersChange();
  }

  onDateChange() {
    if (this.filterDate) this.setPeriod('specific');
    else this.setPeriod('today');
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

  // When filters change, reset pagination
  onFiltersChange() {
      this.currentPage = 1;
      this.calculateStats();
  }


  getStatusClass(status: string): string {
    switch (status) {
      case 'A venir': return 'status-future';
      case 'En cours': return 'status-progress';
      case 'Terminé': return 'status-completed';
      default: return '';
    }
  }

  // Actions
  deleteEmpotage(item: Empotage) {
    if (!item.id) return;
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
      
      // refresh
      await this.loadEmpotages();
    } catch (e) {
      console.error('Erreur suppression', e);
      alert('Erreur lors de la suppression');
    } finally {
      this.cancelDelete();
    }
  }

  editEmpotage(item: Empotage) {
    this.isEditing = true;
    this.currentId = item.id || null;
    
    // Format dates for datetime-local input (YYYY-MM-DDTHH:mm)
    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      // Adjust to local ISO string roughly
      const pad = (n: number) => n < 10 ? '0' + n : n;
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    this.newEmpotage = { 
      ...item,
      dateStart: formatDate(item.dateStart),
      dateEnd: formatDate(item.dateEnd)
    };
    this.showCreateModal = true;
  }

  // Export the currently visible rows as CSV
  exportCsv(filename = 'empotages.csv') {
    const rows = this.filteredEmpotages;
    if (!rows.length) {
      alert('Aucune donnée à exporter.');
      return;
    }

    const headers = ['Client', 'Booking', 'Conteneurs', 'Volume (m3)', 'Début', 'Fin', 'Statut'];
    
    // Helper to format date for CSV (DD/MM/YYYY HH:mm)
    const fmtDate = (isoStr: string | undefined) => {
      if (!isoStr) return '';
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    };

    const escape = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      // Escape for CSV (quotes)
      if (s.includes(';') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    // Use semicolon for better Excel compatibility in FR regions
    const separator = ';';
    
    const csvContent = [headers.join(separator)]
      .concat(rows.map(r => [
        r.client, 
        r.booking, 
        r.conteneurs, 
        r.volume, 
        fmtDate(r.dateStart), 
        fmtDate(r.dateEnd), 
        r.status
      ].map(escape).join(separator)))
      .join('\n');

    // Add BOM for UTF-8 Excel support
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  closeCreateModal() {
    this.showCreateModal = false;
    this.saving = false;
    this.isEditing = false;
    this.currentId = null;
  }

  async saveEmpotage() {
    this.errorMessage = '';
    // Basic validation
    if (!this.newEmpotage.entrepotId) {
       this.errorMessage = 'Erreur interne: aucun entrepôt sélectionné.';
       return;
    }
    if (!this.newEmpotage.client || 
        !this.newEmpotage.booking || 
        !this.newEmpotage.conteneurs || 
        !this.newEmpotage.volume || 
        !this.newEmpotage.dateStart) {
      this.errorMessage = 'Veuillez remplir tous les champs obligatoires (Client, Booking, Booking, Volume, Date de début).';
      return;
    }
    this.saving = true;
    try {
      let url = `${environment.apiUrl}/empotages`;
      let req;

      if (this.isEditing && this.currentId) {
        url = `${environment.apiUrl}/empotages/${this.currentId}`;
        req = this.http.put(url, this.newEmpotage);
      } else {
        req = this.http.post(url, this.newEmpotage);
      }

      await firstValueFrom(req);
      
      this.closeCreateModal();
      // reload list
      await this.loadEmpotages();
      // alert(this.isEditing ? 'Empotage modifié' : 'Empotage créé');
    } catch (e: any) {
      console.error('Erreur sauvegarde empotage', e);
      alert(`Erreur : ${e.status || ''} ${e.message || ''}`);
    } finally {
      this.saving = false;
    }
  }
}
