import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Empotage {
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
    total: 24,
    enCours: 12,
    termines: 8,
    aVenir: 4
  };

  empotages: Empotage[] = [
    {
      client: 'CMA CGM',
      clientType: 'Maritime',
      booking: 'BK-88291',
      conteneurs: 5,
      volume: 120,
      dateStart: '12/10/24',
      dateEnd: '15/10/24',
      status: 'A venir'
    },
    {
      client: 'Maersk Line',
      clientType: 'Global Transport',
      booking: 'BK-99302',
      conteneurs: 2,
      volume: 45,
      dateStart: '10/10/24',
      dateEnd: '12/10/24',
      status: 'En cours'
    },
    {
      client: 'MSC Cargo',
      clientType: 'Logistic Hub',
      booking: 'BK-77110',
      conteneurs: 10,
      volume: 250,
      dateStart: '01/10/24',
      dateEnd: '05/10/24',
      status: 'Terminé'
    },
    {
      client: 'Hapag-Lloyd',
      clientType: 'Maritime Services',
      booking: 'BK-44556',
      conteneurs: 3,
      volume: 75,
      dateStart: '14/10/24',
      dateEnd: '18/10/24',
      status: 'A venir'
    }
  ];
  
  // UI state
  search: string = '';
  filterStatus: '' | 'A venir' | 'En cours' | 'Terminé' = '';
  loading = false;
  // Modal state
  showCreateModal = false;
  saving = false;

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
      if (this.filterStatus && item.status !== this.filterStatus) return false;
      if (!q) return true;
      return (
        item.client.toLowerCase().includes(q) ||
        item.booking.toLowerCase().includes(q)
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
  viewEmpotage(item: Empotage) {
    // Replace with a proper route/modal in future
    alert(`Voir empotage: ${item.booking} — ${item.client}`);
  }

  editEmpotage(item: Empotage) {
    // Replace with actual edit flow
    alert(`Modifier empotage: ${item.booking}`);
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
      if (this.search && this.search.trim() !== '') params.set('q', this.search.trim());
      if (this.filterStatus) params.set('status', this.filterStatus);
      const url = `http://localhost:3000/api/empotages?${params.toString()}`;
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.empotages = data;
    } catch (e) {
      console.error('Erreur chargement empotages', e);
      alert('Erreur chargement empotages (voir console)');
    } finally {
      this.loading = false;
    }
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
    this.showCreateModal = true;
    // reset
    this.newEmpotage = {
      client: '', clientType: '', booking: '', conteneurs: 1, volume: 0, dateStart: '', dateEnd: '', status: 'A venir'
    };
  }

  closeCreateModal() {
    this.showCreateModal = false;
    this.saving = false;
  }

  async createEmpotage() {
    // Basic validation
    if (!this.newEmpotage.client || !this.newEmpotage.booking) {
      alert('Veuillez renseigner au minimum le client et le booking');
      return;
    }
    this.saving = true;
    try {
      const res = await fetch('http://localhost:3000/api/empotages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.newEmpotage)
      });
      if (!res.ok) {
        // Try to read body for a helpful message
        let text = '';
        try { text = await res.text(); } catch (e) { /* ignore */ }
        console.error('createEmpotage failed', res.status, text);
        alert(`Erreur création empotage: ${res.status} ${text || ''}`);
        return;
      }
      const created = await res.json();
      this.closeCreateModal();
      // reload list
      await this.loadEmpotages();
      alert('Empotage créé');
    } catch (e) {
      console.error('Erreur création empotage', e);
      alert('Erreur création empotage (voir console)');
    } finally {
      this.saving = false;
    }
  }
}
