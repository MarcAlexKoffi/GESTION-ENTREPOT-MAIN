import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WarehouseService } from '../services/warehouse.service';

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
  loading = false;
  
  // Modal state
  showCreateModal = false;
  saving = false;
  isEditing = false;
  currentId: number | null = null;
  
  // Delete Modal State
  showDeleteModal = false;
  itemToDelete: Empotage | null = null;

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
    this.loadEmpotages();
    this.loadWarehouses();
  }

  loadWarehouses() {
    this.warehouseService.getWarehouses().subscribe({
        next: (res) => this.warehouses = res,
        error: (err) => console.error('Erreur loading warehouses', err)
    });
  }

  async loadEmpotages() {
    this.loading = true;
    try {
      const params = new URLSearchParams();
      // On backend, q and status are handled, but we filter client-side for reactivity too
      // if (this.search && this.search.trim() !== '') params.set('q', this.search.trim());
      // if (this.filterStatus) params.set('status', this.filterStatus);
      const url = `http://localhost:3000/api/empotages`;
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.empotages = data;
      this.calculateStats();
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
    window.location.href = `http://localhost:3000/api/empotages/export?${params.toString()}`;
  }

  openCreateModal() {
    this.isEditing = false;
    this.currentId = null;
    this.showCreateModal = true;
    // reset
    this.newEmpotage = {
      client: '', booking: '', conteneurs: 1, volume: 0, dateStart: '', dateEnd: '', status: 'A venir',
      entrepotId: this.warehouses.length > 0 ? this.warehouses[0].id : undefined // Default to first
    };
  }
  get filteredEmpotages(): Empotage[] {
    const q = this.search.trim().toLowerCase();
    return this.empotages.filter(item => {
      // 1. Filter by Date (comparing dateStart YYYY-MM-DD in local time)
      if (this.filterDate) {
        if (!item.dateStart) return false;
        const d = new Date(item.dateStart);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        return dateStr === this.filterDate;
      }
      
      // 2. Filter by search query
      if (!q) return true;
      return (
        (item.client || '').toLowerCase().includes(q) ||
        (item.booking || '').toLowerCase().includes(q)
      );
    });
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
      const res = await fetch(`http://localhost:3000/api/empotages/${this.itemToDelete.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
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
    // Basic validation
    if (!this.newEmpotage.client || !this.newEmpotage.booking) {
      alert('Veuillez renseigner au minimum le client et le booking');
      return;
    }
    this.saving = true;
    try {
      let url = 'http://localhost:3000/api/empotages';
      let method = 'POST';

      if (this.isEditing && this.currentId) {
        url = `http://localhost:3000/api/empotages/${this.currentId}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.newEmpotage)
      });

      if (!res.ok) {
        // Try to read body for a helpful message
        let text = '';
        try { text = await res.text(); } catch (e) { /* ignore */ }
        console.error('saveEmpotage failed', res.status, text);
        alert(`Erreur : ${res.status} ${text || ''}`);
        return;
      }
      
      this.closeCreateModal();
      // reload list
      await this.loadEmpotages();
      // alert(this.isEditing ? 'Empotage modifié' : 'Empotage créé');
    } catch (e) {
      console.error('Erreur sauvegarde empotage', e);
      alert('Erreur sauvegarde empotage (voir console)');
    } finally {
      this.saving = false;
    }
  }
}
