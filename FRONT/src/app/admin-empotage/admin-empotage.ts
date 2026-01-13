import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
}

@Component({
  selector: 'app-admin-empotage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-empotage.html',
  styleUrl: './admin-empotage.scss',
})
export class AdminEmpotage implements OnInit {
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

  async ngOnInit() {
    await this.loadOperations();
  }

  async loadOperations() {
    this.loading = true;
    try {
      const url = `http://localhost:3000/api/empotages`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.rawOperations = data;
      this.operations = data.map((item: any) => this.mapToOperation(item));
      this.calculateStats();
    } catch (e) {
      console.error('Erreur chargement empotages admin', e);
    } finally {
      this.loading = false;
    }
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
      statut: item.status || 'A venir'
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

  getStatusClass(statut: string): string {
    switch (statut) {
      case 'En cours': return 'status-encours';
      case 'Terminé': return 'status-termine';
      case 'A venir': 
      case 'Prévu': return 'status-prevu';
      default: return 'status-default';
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
    // Re-apply filters if we implement client-side filtering here
    // For now it just resets the inputs
  }
}
