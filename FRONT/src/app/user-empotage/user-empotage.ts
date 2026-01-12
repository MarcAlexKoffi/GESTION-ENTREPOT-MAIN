import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

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
  imports: [CommonModule],
  templateUrl: './user-empotage.html',
  styleUrl: './user-empotage.scss',
})
export class UserEmpotage {
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

  getStatusClass(status: string): string {
    switch (status) {
      case 'A venir': return 'status-future';
      case 'En cours': return 'status-progress';
      case 'Terminé': return 'status-completed';
      default: return '';
    }
  }
}
