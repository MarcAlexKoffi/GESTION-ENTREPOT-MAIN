import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Empotage {
  id?: number;
  client: string;
  clientType: string;
  booking: string;
  conteneurs: number;
  volume: number;
  dateStart: string;
  dateEnd: string;
  status: 'A venir' | 'En cours' | 'Terminé';
}

@Component({
  selector: 'app-user-empotage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-empotage.html',
  styleUrl: './user-empotage.scss',
})
export class UserEmpotage implements OnInit {
  stats = {
    total: 0,
    enCours: 0,
    termines: 0,
    aVenir: 0
  };

  empotages: Empotage[] = [];
  
  // UI state
  search: string = '';
  filterStatus: '' | 'A venir' | 'En cours' | 'Terminé' = '';
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
    clientType: '',
    booking: '',
    conteneurs: 1,
    volume: 0,
    dateStart: '',
    dateEnd: '',
    status: 'A venir'
  };

  // Computed list (applies search and status filter)
  get filteredEmpotages(): Empotage[] {
    const q = this.search.trim().toLowerCase();
    return this.empotages.filter(item => {
      // 1. Filter by status
      if (this.filterStatus && item.status !== this.filterStatus) return false;
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
    const escape = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      // escape double quotes
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const csv = [headers.join(',')]
      .concat(rows.map(r => [r.client, r.booking, r.conteneurs, r.volume, r.dateStart, r.dateEnd, r.status].map(escape).join(',')))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // --- Server integration ---
  ngOnInit(): void {
    this.loadEmpotages();
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
    this.stats = {
      total: this.empotages.length,
      enCours: this.empotages.filter(e => e.status === 'En cours').length,
      termines: this.empotages.filter(e => e.status === 'Terminé').length,
      aVenir: this.empotages.filter(e => e.status === 'A venir').length
    };
  }

  // Trigger server-side CSV download
  exportCsvServer() {
    const params = new URLSearchParams();
    if (this.search && this.search.trim() !== '') params.set('q', this.search.trim());
    if (this.filterStatus) params.set('status', this.filterStatus);
    const url = `http://localhost:3000/api/empotages/export?${params.toString()}`;
    window.open(url, '_blank');
  }

  openCreateModal() {
    this.isEditing = false;
    this.currentId = null;
    this.showCreateModal = true;
    // reset
    this.newEmpotage = {
      client: '', clientType: '', booking: '', conteneurs: 1, volume: 0, dateStart: '', dateEnd: '', status: 'A venir'
    };
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
