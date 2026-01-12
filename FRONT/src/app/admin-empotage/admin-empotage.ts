import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface EmpotageStats {
  total: number;
  totalTrend: number; // percentage
  aVenir: number;
  aVenirTrend: number;
  enCours: number;
  enCoursTrend: number;
  termines: number;
  terminesTrend: number;
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
  statut: 'En cours' | 'Terminé' | 'Prévu';
}

@Component({
  selector: 'app-admin-empotage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-empotage.html',
  styleUrl: './admin-empotage.scss',
})
export class AdminEmpotage {
  stats: EmpotageStats = {
    total: 1284,
    totalTrend: 5,
    aVenir: 32,
    aVenirTrend: 12,
    enCours: 14,
    enCoursTrend: -2,
    termines: 82,
    terminesTrend: 8
  };

  filters = {
    client: 'all',
    booking: '',
    dateDebut: '',
    dateFin: ''
  };

  operations: EmpotageOperation[] = [
    {
      id: 1,
      clientName: 'CMA CGM France',
      clientInitials: 'CM',
      clientColor: 'bg-blue-100 text-blue-600',
      booking: 'BK-2023-00192',
      conteneurs: "4 x 40' HC",
      volume: 272.5,
      debutPrevu: '22/05 08:30',
      finEstimee: '22/05 16:00',
      statut: 'En cours'
    },
    {
      id: 2,
      clientName: 'Maersk Logistics',
      clientInitials: 'MA',
      clientColor: 'bg-purple-100 text-purple-600',
      booking: 'BK-2023-00204',
      conteneurs: "2 x 20' ST",
      volume: 66.4,
      debutPrevu: '22/05 09:15',
      finEstimee: '22/05 14:30',
      statut: 'En cours'
    },
    {
      id: 3,
      clientName: 'MSC Shipping',
      clientInitials: 'MS',
      clientColor: 'bg-green-100 text-green-600',
      booking: 'BK-2023-00188',
      conteneurs: "1 x 40' HC",
      volume: 68.2,
      debutPrevu: '22/05 07:00',
      finEstimee: '22/05 11:20',
      statut: 'Terminé'
    },
    {
      id: 4,
      clientName: 'TransFret SARL',
      clientInitials: 'TF',
      clientColor: 'bg-gray-100 text-gray-600',
      booking: 'BK-2023-00215',
      conteneurs: "8 x 40' HC",
      volume: 545.0,
      debutPrevu: '23/05 08:00',
      finEstimee: '24/05 17:00',
      statut: 'Prévu'
    },
    {
      id: 5,
      clientName: 'Hapag-Lloyd',
      clientInitials: 'HB',
      clientColor: 'bg-blue-50 text-blue-500',
      booking: 'BK-2023-00210',
      conteneurs: "3 x 40' ST",
      volume: 201.0,
      debutPrevu: '22/05 10:45',
      finEstimee: '22/05 19:30',
      statut: 'En cours'
    }
  ];

  getStatusClass(statut: string): string {
    switch (statut) {
      case 'En cours': return 'status-encours';
      case 'Terminé': return 'status-termine';
      case 'Prévu': return 'status-prevu';
      default: return '';
    }
  }

  getStatusIcon(statut: string): string {
    switch (statut) {
      case 'En cours': return 'sync'; // or hourglass_empty
      case 'Terminé': return 'check_circle';
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
  }
}
