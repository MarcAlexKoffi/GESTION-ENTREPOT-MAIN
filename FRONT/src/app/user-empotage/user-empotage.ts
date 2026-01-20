import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { WarehouseService } from '../services/warehouse.service';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { environment } from '../config';

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
  private toastService = inject(ToastService);
  
  warehouses: any[] = [];
  empotages: Empotage[] = [];
  
  // Stats
  stats = { total: 0, today: 0, week: 0, month: 0, year: 0 };

  // UI state
  search: string = '';
  filterDate: string = '';
  period: 'today' | 'week' | 'month' | 'year' | 'specific' = 'today';
  loading = false;
  selectedWarehouseId: number | null = null;
  
  // === MODAL STATES ===
  
  // 1. New Empotage Modal (Initial)
  showCreateModal = false;
  
  // 2. Add Container Modal
  showAddContainerModal = false;
  selectedBookingForAdd: Empotage | null = null;
  
  // 3. History Modal
  showHistoryModal = false;
  selectedBookingHistory: Empotage | null = null;

  // 4. Finalize Confirmation Modal
  showFinalizeModal = false;
  lastSavedEmpotageId: number | null = null; 

  // Delete Modal
  showDeleteModal = false;
  itemToDelete: Empotage | null = null;
  
  // Edit Modal
  showEditModal = false;
  editingId: number | null = null;
  formEditContainer = {
    numeroConteneur: '',
    nombreSacs: 0,
    volume: 0,
    poids: 0
  };

  // Generic State
  saving = false;
  errorMessage: string = '';

  // Form A: Initial Creation (Header + First Container)
  formInit = {
    client: '',
    booking: '',
    numeroConteneur: '',
    nombreSacs: null as number | null,
    volume: null as number | null,
    poids: null as number | null,
    entrepotId: 0
  };

  // Form B: Add Container (Just Container data)
  formContainer = {
    numeroConteneur: '',
    nombreSacs: null as number | null,
    volume: null as number | null,
    poids: null as number | null
  };

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
  
  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user && user.entrepotId) {
      this.selectedWarehouseId = user.entrepotId;
      this.formInit.entrepotId = user.entrepotId;
    }
    this.loadWarehouses();
  }

  loadWarehouses() {
    this.warehouseService.getWarehouses().subscribe({
        next: (res) => {
          this.warehouses = res;
          if (this.warehouses.length > 0 && !this.selectedWarehouseId) {
            this.selectedWarehouseId = this.warehouses[0].id;
            this.formInit.entrepotId = this.warehouses[0].id;
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
    } catch (e) {
      console.error('Erreur chargement empotages', e);
      this.toastService.error('Impossible de charger les données');
    } finally {
      this.loading = false;
    }
  }

  // --- ACTIONS ---

  // 1. INIT EMPOTAGE (Booking + Container 1)
  openInitModal() {
    this.errorMessage = '';
    this.formInit = {
      client: '',
      booking: '',
      numeroConteneur: '',
      nombreSacs: null,
      volume: null,
      poids: null,
      entrepotId: this.selectedWarehouseId || 0
    };
    this.showCreateModal = true;
  }

  closeInitModal() {
    this.showCreateModal = false;
  }

  async submitInit() {
    if(!this.formInit.client || !this.formInit.booking || !this.formInit.numeroConteneur) {
        this.errorMessage = "Veuillez remplir les champs obligatoires";
        return;
    }
    
    this.saving = true;
    try {
        const res = await firstValueFrom(this.http.post<Empotage>(`${environment.apiUrl}/empotages/init`, this.formInit));
        this.lastSavedEmpotageId = res.id!;
        this.showCreateModal = false;
        this.toastService.success('Booking créé avec succès');
        
        // Ask for finalization
        this.showFinalizeModal = true;
        
        this.loadEmpotages();
    } catch(err) {
        console.error(err);
        this.errorMessage = "Erreur lors de la création";
        this.toastService.error('Erreur lors de la création');
    } finally {
        this.saving = false;
    }
  }

  // 2. ADD CONTAINER
  openAddContainerModal(booking: Empotage) {
    if(booking.status === 'Terminé') return;
    
    this.errorMessage = '';
    this.selectedBookingForAdd = booking;
    this.formContainer = {
       numeroConteneur: '',
       nombreSacs: null,
       volume: null,
       poids: null
    };
    this.showAddContainerModal = true;
  }

  closeAddContainerModal() {
    this.showAddContainerModal = false;
    this.selectedBookingForAdd = null;
  }

  async submitAddContainer() {
    if(!this.selectedBookingForAdd || !this.formContainer.numeroConteneur) {
        this.errorMessage = "Numéro conteneur requis";
        return;
    }

    this.saving = true;
    try {
        await firstValueFrom(this.http.post(`${environment.apiUrl}/empotages/${this.selectedBookingForAdd.id}/add-container`, this.formContainer));
        
        this.lastSavedEmpotageId = this.selectedBookingForAdd.id!;
        this.showAddContainerModal = false;
        this.toastService.success('Conteneur ajouté');

        // Ask for finalization
        this.showFinalizeModal = true;

        this.loadEmpotages();
    } catch(err) {
        console.error(err);
        this.errorMessage = "Erreur ajout conteneur";
        this.toastService.error('Erreur ajout conteneur');
    } finally {
        this.saving = false;
    }
  }

  // --- EDIT CONTAINER ACTIONS ---
  openEditContainerModal(container: EmpotageContainer) {
    if(!container.id) return;
    this.errorMessage = '';
    this.editingId = container.id;
    this.formEditContainer = {
        numeroConteneur: container.numeroConteneur,
        nombreSacs: container.nombreSacs,
        volume: container.volume,
        poids: container.poids
    };
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.editingId = null;
  }

  async submitEdit() {
      if(!this.editingId) return;
      if(!this.formEditContainer.numeroConteneur) {
          this.errorMessage = "Numéro conteneur requis";
          return;
      }

      this.saving = true;
      try {
          // Endpoint: PUT /empotage-containers/:id
          await firstValueFrom(this.http.put(`${environment.apiUrl}/empotage-containers/${this.editingId}`, this.formEditContainer));
          
          this.showEditModal = false;
          this.toastService.success('Conteneur modifié');
          
          // Reload current history (if we are in history view)
          if(this.selectedBookingHistory && this.selectedBookingHistory.id) {
             const fullData = await firstValueFrom(this.http.get<Empotage>(`${environment.apiUrl}/empotages/${this.selectedBookingHistory.id}`));
             this.selectedBookingHistory.containers = fullData.containers;
             // Also refresh main list to update totals if needed
             this.loadEmpotages();
          }
      } catch(e) {
          console.error(e);
          this.errorMessage = "Erreur modification conteneur";
          this.toastService.error('Erreur modification conteneur');
      } finally {
          this.saving = false;
      }
  }

  // 3. HISTORY
  async openHistory(item: Empotage) {
    if(!item.id) return;
    this.selectedBookingHistory = item;
    // Load details if not present or always fresh load
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
  
  openFinalizeManually(item: Empotage) {
      if(item.status === 'Terminé') return;
      this.lastSavedEmpotageId = item.id!;
      this.showFinalizeModal = true;
  }

  exportHistoryCsv() {
    if (!this.selectedBookingHistory || !this.selectedBookingHistory.containers) return;

    // Entêtes pour le fichier CSV
    const headers = ['Booking', 'Conteneur', 'Sacs', 'Volume (m³)', 'Poids (kg)', 'Date Ajout'];
    
    // Construction des lignes
    const rows = this.selectedBookingHistory.containers.map(c => {
      const dateAjout = c.createdAt ? new Date(c.createdAt).toLocaleDateString('fr-FR') + ' ' + new Date(c.createdAt).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}) : '';
      
      const clean = (str: string) => (str || '').replace(/;/g, ',');

      return [
        clean(this.selectedBookingHistory!.booking),
        clean(c.numeroConteneur),
        c.nombreSacs,
        (c.volume || 0).toLocaleString('fr-FR'),
        (c.poids || 0).toLocaleString('fr-FR'),
        dateAjout
      ].join(';');
    });

    const csvContent = [headers.join(';'), ...rows].join('\n');
    
    // Ajout du BOM pour l'encodage UTF-8 correct dans Excel
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Téléchargement
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historique_${this.selectedBookingHistory.booking}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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

  // 4. FINALIZE (Modale Oui/Non)
  closeFinalizeModal() {
    // Action = NON (Pas terminé)
    this.showFinalizeModal = false;
    this.lastSavedEmpotageId = null;
  }

  async confirmFinalize() {
    // Action = OUI (Terminé)
    if(!this.lastSavedEmpotageId) return;

    this.saving = true;
    try {
        await firstValueFrom(this.http.put(`${environment.apiUrl}/empotages/${this.lastSavedEmpotageId}/finalize`, {}));
        this.showFinalizeModal = false;
        this.lastSavedEmpotageId = null;
        this.toastService.success('Empotage marqué comme terminé');
        this.loadEmpotages();
    } catch(err) {
       console.error(err);
       this.toastService.error('Erreur lors de la finalisation');
    } finally {
       this.saving = false;
    }
  }

  // 4. DELETE
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
      this.cancelDelete();
      this.toastService.success('Empotage supprimé');
      this.loadEmpotages();
    } catch(err) {
      console.error(err);
      this.toastService.error('Erreur lors de la suppression');
    }
  }

  // --- FILTERING & STATS ---

  get filteredEmpotages(): Empotage[] {
    const q = this.search.trim().toLowerCase();
    return this.empotages.filter(item => {
      // 1. Filter by Period
      if (!this.isInSelectedPeriod(item.dateStart)) return false;
      
      // 2. Filter by search query
      if (!q) return true;
      return (
        (item.client || '').toLowerCase().includes(q) ||
        (item.booking || '').toLowerCase().includes(q) ||
        (item.status || '').toLowerCase().includes(q)
      );
    });
  }

  onFiltersChange() {
      this.currentPage = 1;
      this.calculateStats();
  }

  setPeriod(p: 'today' | 'week' | 'month' | 'year' | 'specific') {
    this.period = p;
    if (p !== 'specific') this.filterDate = '';
    this.currentPage = 1;
    this.calculateStats();
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
    if (this.period === 'today') return created.toDateString() === now.toDateString();
    if (this.period === 'week') return created >= startOfWeek;
    if (this.period === 'month') return created >= startOfMonth;
    if (this.period === 'year') return created >= startOfYear;
    return true;
  }

  calculateStats() {
    const now = new Date();
    // Same period logic for stats
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentDay = now.getDay() || 7; 
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - (currentDay - 1));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const all = this.empotages;

    this.stats = {
      total: all.length,
      today: all.filter(e => e.dateStart && new Date(e.dateStart).toDateString() === now.toDateString()).length,
      week: all.filter(e => e.dateStart && new Date(e.dateStart) >= startOfWeek).length,
      month: all.filter(e => e.dateStart && new Date(e.dateStart) >= startOfMonth).length,
      year: all.filter(e => e.dateStart && new Date(e.dateStart) >= startOfYear).length
    };
  }
  
  exportCsvClient() {
    // Entêtes pour le fichier CSV
    const headers = ['Client', 'Booking', 'Conteneurs', 'Volume (m³)', 'Date Début', 'Date Fin', 'Statut'];
    
    // Construction des lignes
    const rows = this.filteredEmpotages.map(item => {
      const start = item.dateStart ? new Date(item.dateStart).toLocaleDateString('fr-FR') : '';
      const end = item.dateEnd ? new Date(item.dateEnd).toLocaleDateString('fr-FR') : '';
      
      // Nettoyage des données pour le CSV (échappement des points-virgules si nécessaire)
      const clean = (str: string) => (str || '').replace(/;/g, ',');

      return [
        clean(item.client),
        clean(item.booking),
        item.conteneurs,
        (item.volume || 0).toLocaleString('fr-FR'), // Format nombre avec virgule
        start,
        end,
        clean(item.status)
      ].join(';'); // Utilisation du point-virgule pour Excel version FR
    });

    const csvContent = [headers.join(';'), ...rows].join('\n');
    
    // Ajout du BOM pour l'encodage UTF-8 correct dans Excel
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Téléchargement
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `empotages_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  getStatusClass(status: string): string {
     if (status === 'Terminé') return 'status-completed';
     return 'status-future'; // 'En attente'
  }
}
