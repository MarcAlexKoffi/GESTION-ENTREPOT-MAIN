import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TruckService, Truck } from '../services/truck.service';
import { WarehouseService, StoredWarehouse } from '../services/warehouse.service';

type TruckStatus = Truck['statut'];

interface TruckHistoryRow {
  entrepotId: number;
  entrepotName: string;
  immatriculation: string;
  cooperative: string;
  kor: string;
  th?: string;
  heureArrivee: string;
  debutDechargement: string;
  finDechargement: string;
  statut: TruckStatus;
  advancedStatus?: string; // Ajout du statut avancé
  createdAt: string; // utile pour le filtre par période
  history?: Array<{ event: string; by?: string; date?: string }>;
}

@Component({
  selector: 'app-historique',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './historique.html',
  styleUrl: './historique.scss',
})
export class Historique implements OnInit {
  // toutes les lignes (avant filtre)
  allRows: TruckHistoryRow[] = [];

  // lignes après filtre (celles affichées dans le tableau)
  filteredRows: TruckHistoryRow[] = [];

  // Pagination
  paginatedRows: TruckHistoryRow[] = [];
  currentPage = 1;
  itemsPerPage = 10;

  // champs de filtre
  searchTerm = '';
  selectedWarehouseId: number | 'all' = 'all';
  selectedStatus: string = 'all';
  selectedDate: string = ''; // Format YYYY-MM-DD

  // options pour la liste des entrepôts
  warehousesOptions: StoredWarehouse[] = [];

  // Details modal state
  showDetailsModal = false;
  selectedRow: TruckHistoryRow | null = null;

  constructor(
    private truckService: TruckService,
    private warehouseService: WarehouseService,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  // Charge les entrepôts + camions depuis l'API
  private loadData(): void {
    // 1) Entrepôts
    this.warehouseService.getWarehouses().subscribe({
      next: (warehouses) => {
        this.warehousesOptions = warehouses;
        this.loadTrucks();
      },
      error: (err) => {
        console.error('Erreur loading warehouses', err);
        // Fallback empty but try loading trucks anyway?
        this.loadTrucks();
      },
    });
  }

  private loadTrucks(): void {
    this.truckService.getTrucks().subscribe({
      next: (trucks) => {
        this.allRows = trucks.map((t) => {
          const warehouse = this.warehousesOptions.find((w) => w.id === t.entrepotId) ?? null;

          return {
            entrepotId: t.entrepotId,
            entrepotName: warehouse ? warehouse.name : 'Entrepôt inconnu',
            immatriculation: t.immatriculation,
            cooperative: t.cooperative || '',
            kor: t.kor || '',
            // TH (élément d'analyse) may be named differently server-side; try common candidates
            th: (t as any).th || (t as any).thElement || (t as any).TH || '',
            heureArrivee: t.heureArrivee,
            // TODO: Checker si debut/finDechargement existent dans Truck
            // Pour l'instant on met '-' car ce n'est pas explicite dans l'interface Truck
            debutDechargement: '-',
            finDechargement: '-',
            statut: t.statut,
            advancedStatus: (t as any).advancedStatus,
            createdAt: t.createdAt || new Date().toISOString(),
            history: t.history || [],
          };
        });

        // Tri : le plus récent en premier
        this.allRows.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        this.applyFilters();
      },
      error: (err) => console.error('Erreur loading trucks', err),
    });
  }

  // Applique tous les filtres à la fois
  applyFilters(): void {
    const search = this.searchTerm.trim().toLowerCase();

    const now = new Date();

    this.filteredRows = this.allRows.filter((row) => {
      // 1) Filtre texte (immat OU transporteur)
      if (search) {
        const haystack = (row.immatriculation + ' ' + row.cooperative).toLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }

      // 2) Filtre entrepôt
      if (this.selectedWarehouseId !== 'all') {
        if (row.entrepotId !== Number(this.selectedWarehouseId)) {
          return false;
        }
      }

      // 3) Filtre statut
      if (this.selectedStatus !== 'all') {
        const s = this.selectedStatus;
        const rowStatut = row.statut;
        const rowAdv = row.advancedStatus;

        if (s === 'Enregistré') {
          if (rowStatut !== 'Enregistré') return false;
        } else if (s === 'En attente') {
          if (rowStatut !== 'En attente') return false;
        } else if (s === 'Validé') {
          // Validé MAIS PAS Accepté final
          if (rowStatut !== 'Validé' || rowAdv === 'ACCEPTE_FINAL') return false;
        } else if (s === 'Accepté') {
          if (rowAdv !== 'ACCEPTE_FINAL') return false;
        } else if (s === 'Refoulé') {
          // Refoulé OU (Annulé mais PAS Renvoyé)
          const isRefoule = rowStatut === 'Refoulé';
          const isAnnuleOther = rowStatut === 'Annulé' && rowAdv !== 'REFUSE_RENVOYE';
          if (!isRefoule && !isAnnuleOther) return false;
        } else if (s === 'Renvoyé') {
          if (rowStatut !== 'Annulé' || rowAdv !== 'REFUSE_RENVOYE') return false;
        } else {
          // Fallback pour statuts simples s'ils existent (ex: string exact)
          if (rowStatut !== s) return false;
        }
      }

      // 4) Filtre par date exacte
      if (this.selectedDate) {
        const created = new Date(row.createdAt);

        // Si createdAt est invalide, on exclut la ligne
        if (isNaN(created.getTime())) {
          return false;
        }

        // Date locale YYYY-MM-DD
        const toLocalYMD = (d: Date) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        };

        if (toLocalYMD(created) !== this.selectedDate) {
          return false;
        }
      }

      return true;
    });

    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedRows = this.filteredRows.slice(startIndex, endIndex);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredRows.length / this.itemsPerPage) || 1;
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  private formatDateTime(dateStr: string): string {
    const d = new Date(dateStr);

    if (isNaN(d.getTime())) {
      return '';
    }

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  private getTodayFileName(): string {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    return `${year}-${month}-${day}`;
  }

  exporterCSV(): void {
    if (!this.filteredRows || this.filteredRows.length === 0) {
      alert('Aucune donnée à exporter.');
      return;
    }

    // Export exactly 6 columns to match spec
    const headers = [
      'Entrepôt',
      'Immatriculation',
      'Coopérative',
      'Date Arrivée Camion',
      "Heure d'enregistrement",
      'Statut',
    ];

    const rows = this.filteredRows.map((row) => {
      const entrepot = this.warehousesOptions.find((w) => w.id === row.entrepotId);

      const created = row.createdAt ? new Date(row.createdAt) : null;
      const dateArrive =
        created && !isNaN(created.getTime())
          ? `${String(created.getDate()).padStart(2, '0')}/${String(
              created.getMonth() + 1,
            ).padStart(2, '0')}/${created.getFullYear()}`
          : '';
      const heureEnreg =
        created && !isNaN(created.getTime())
          ? `${String(created.getHours()).padStart(2, '0')}:${String(created.getMinutes()).padStart(
              2,
              '0',
            )}`
          : '';

      // For the Excel export we include exactly 6 columns: entrepot, immat, transporteur, date, heure enreg, statut
      return [
        entrepot ? entrepot.name : '',
        row.immatriculation,
        row.cooperative,
        dateArrive,
        heureEnreg,
        row.statut,
      ];
    });

    // Préfixer BOM pour Excel et utiliser ; comme séparateur
    const csvBody = [
      headers.join(';'),
      ...rows.map((r) => r.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';')),
    ].join('\n');
    const csvContent = '\uFEFF' + csvBody;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `historique_camions_${this.getTodayFileName()}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  openDetailsModal(row: TruckHistoryRow): void {
    // Deep clone the row so the modal shows a snapshot (won't change
    // if the underlying data/table is updated while the modal is open)
    try {
      this.selectedRow = JSON.parse(JSON.stringify(row));
    } catch (e) {
      // Fallback to shallow copy if JSON clone fails for any reason
      this.selectedRow = Object.assign({}, row);
    }

    // Ensure history is sorted newest-first when present
    if (this.selectedRow && Array.isArray(this.selectedRow.history)) {
      this.selectedRow.history.sort((a, b) => {
        const da = a && a.date ? new Date(a.date).getTime() : 0;
        const db = b && b.date ? new Date(b.date).getTime() : 0;
        return db - da;
      });
    }

    this.showDetailsModal = true;
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedRow = null;
  }

  // Helpers pour les labels dans le template
  getStatusCssClass(statut: string): string {
    switch (statut) {
      case 'Déchargé':
        return 'status-pill status-pill--validated';
      case 'En attente':
        return 'status-pill status-pill--pending';
      case 'Annulé':
      case 'Refoulé':
        return 'status-pill status-pill--refoule';
      case 'En cours de déchargement':
        return 'status-pill status-pill--enregistre';
      case 'Enregistré':
        return 'status-pill status-pill--enregistre';
      case 'Validé':
        return 'status-pill status-pill--validated';
      default:
        return 'status-pill';
    }
  }

  getStatusIcon(statut: string): string {
    switch (statut) {
      case 'Déchargé':
      case 'Validé':
        return 'check_circle';
      case 'En attente':
        return 'hourglass_empty';
      case 'Annulé':
      case 'Refoulé':
        return 'cancel';
      case 'En cours de déchargement':
        return 'sync';
      case 'Enregistré':
        return 'save_as';
      default:
        return 'help_outline';
    }
  }

  formatHeure(date?: string): string {
    if (!date) {
      return '-';
    }
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
