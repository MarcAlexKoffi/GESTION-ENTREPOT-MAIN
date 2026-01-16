import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TruckService, Truck } from '../services/truck.service';
import { WarehouseService, StoredWarehouse } from '../services/warehouse.service';

@Component({
  selector: 'app-entrepot',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './entrepot.html',
  styleUrl: './entrepot.scss',
})
export class Entrepot implements OnInit {
  entrepot = {
    id: 0,
    nom: '',
    lieu: '',
  };
  searchTerm: string = '';
  selectedPeriod: 'today' | 'week' | 'month' | 'year' | 'specific' = 'today';
  filterDate: string = '';

  // Ajout de la nouvelle catégorie RENVOYÉS
  currentTab: 'pending' | 'validated' | 'accepted' | 'cancelled' | 'renvoyes' = 'pending';

  showDetailsModal = false;
  showHistoryModal = false;
  historyTruck: Truck | null = null;
  
  // Notification Banner
  showNotificationBanner = false;
  notificationMessage = '';

  trucks: Truck[] = [];
  selectedTruck: Truck | null = null;
  adminComment: string = '';

  private readonly truckStorageKey = 'trucks';
  // private readonly commentStorageKey = 'truckAdminComments'; // Plus utilisé

  private route = inject(ActivatedRoute);
  private truckService = inject(TruckService);
  private warehouseService = inject(WarehouseService);
  
  showNotification(msg: string) {
    this.notificationMessage = msg;
    this.showNotificationBanner = true;
    setTimeout(() => {
      this.showNotificationBanner = false;
    }, 4000);
  }

  constructor() {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const idParam = Number(params.get('id'));

      // Reset potentially stale data while loading
      this.entrepot = { id: 0, nom: 'Chargement...', lieu: '...' };
      this.trucks = [];

      // Try API first, fallback to localStorage if it fails
      this.warehouseService.getWarehouse(idParam).subscribe({
        next: (w: any) => {
          this.entrepot = { id: w.id, nom: w.name, lieu: w.location };
          this.loadTrucks();
        },
        error: () => {
          let warehouses: StoredWarehouse[] = [];
          const saved = localStorage.getItem('warehouses');
          if (saved) {
            try {
              warehouses = JSON.parse(saved);
            } catch (e) {
              warehouses = [];
            }
          }

          if (warehouses.length === 0) {
            warehouses = [
              { id: 1, name: 'Entrepôt Lyon Sud', location: 'Corbas, Rhône-Alpes', imageUrl: '' },
            ];
          }

          const found = warehouses.find((x) => x.id === idParam) ?? warehouses[0];
          this.entrepot = { id: found.id, nom: found.name, lieu: found.location };
          this.loadTrucks();
        },
      });
    });
  }

  // ================================================================
  // CHARGEMENT CAMIONS
  // ================================================================
  private loadTrucks(): void {
    this.truckService.getTrucks(this.entrepot.id).subscribe({
      next: (data) => {
        this.trucks = data;
      },
      error: (err) => console.error('Erreur chargement camions', err),
    });
  }

  // private saveTrucks(): void { ... } // Supprimé
  private refreshView(): void {
    this.loadTrucks();
  }

  // ================================================================
  // COMMENTAIRES ADMIN
  // ================================================================
  // loadCommentForTruck et saveComment sont supprimés car intégrés dans l'objet Truck (metadata)

  // ================================================================
  // HEURE PAR CATÉGORIE (colonne "Heure arrivée")
  // ================================================================
  private formatHourFromIso(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private findHistoryDate(truck: Truck, event: string): string | undefined {
    const list = (truck as any).history || [];
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i]?.event === event && list[i]?.date) return list[i].date;
    }
    return undefined;
  }

  // Choose the most relevant timestamp for period filtering and display
  private getDateForPeriod(truck: Truck): string {
    try {
      // If cancelled / refused variations
      if (truck.statut === 'Annulé') {
        const adv = (truck as any).advancedStatus;
        if (adv === 'REFUSE_RENVOYE') {
          return (
            (truck as any).renvoyeAt ||
            this.findHistoryDate(truck, 'Camion renvoyé par le gérant') ||
            (truck as any).refusedAt ||
            this.findHistoryDate(truck, 'Refus administrateur') ||
            (truck as any).createdAt ||
            truck.heureArrivee ||
            ''
          );
        }

        if (adv === 'REFUSE_EN_ATTENTE_GERANT') {
          return (
            (truck as any).refusedAt ||
            this.findHistoryDate(truck, 'Refus administrateur') ||
            (truck as any).createdAt ||
            truck.heureArrivee ||
            ''
          );
        }

        // fallback for other annulled states
        return (
          (truck as any).refusedAt ||
          (truck as any).renvoyeAt ||
          this.findHistoryDate(truck, 'Refus administrateur') ||
          this.findHistoryDate(truck, 'Camion renvoyé par le gérant') ||
          (truck as any).createdAt ||
          truck.heureArrivee ||
          ''
        );
      }

      // Accepted final
      if ((truck as any).advancedStatus === 'ACCEPTE_FINAL') {
        return (
          (truck as any).finalAcceptedAt ||
          this.findHistoryDate(truck, 'Détails produits renseignés — Camion accepté') ||
          (truck as any).createdAt ||
          truck.heureArrivee ||
          ''
        );
      }

      // Reintegrated (admin reintegration)
      if ((truck as any).advancedStatus === 'REFUSE_REINTEGRE') {
        return (
          (truck as any).reintegratedAt ||
          this.findHistoryDate(truck, 'Réintégration administrateur') ||
          (truck as any).createdAt ||
          truck.heureArrivee ||
          ''
        );
      }

      // Validated (prefer validatedAt or history)
      if (truck.statut === 'Validé') {
        return (
          (truck as any).validatedAt ||
          this.findHistoryDate(truck, 'Validation administrateur') ||
          (truck as any).createdAt ||
          truck.heureArrivee ||
          ''
        );
      }

      // In waiting (prefer analysis send event)
      if (truck.statut === 'En attente') {
        return (
          this.findHistoryDate(truck, 'Analyses envoyées à l’administrateur') ||
          (truck as any).createdAt ||
          truck.heureArrivee ||
          ''
        );
      }

      // Default: createdAt or heureArrivee
      return (truck as any).createdAt || truck.heureArrivee || '';
    } catch (e) {
      return (truck as any).createdAt || truck.heureArrivee || '';
    }
  }

  private isInSelectedPeriod(dateIso: string): boolean {
    if (!dateIso) return false;
    // if selectedPeriod was previous 'all' or '7days' etc... 
    // Wait, I changed the type above. I should logic here.

    const created = new Date(dateIso);
    const now = new Date();

    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentDay = now.getDay() || 7; 
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - (currentDay - 1));

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    if (this.selectedPeriod === 'specific' && this.filterDate) {
      const target = new Date(this.filterDate);
      return (
        created.getFullYear() === target.getFullYear() &&
        created.getMonth() === target.getMonth() &&
        created.getDate() === target.getDate()
      );
    }

    if (this.selectedPeriod === 'today') {
      return created.toDateString() === now.toDateString();
    }
    if (this.selectedPeriod === 'week') {
      return created >= startOfWeek;
    }
    if (this.selectedPeriod === 'month') {
      return created >= startOfMonth;
    }
    if (this.selectedPeriod === 'year') {
      return created >= startOfYear;
    }
    
    // fallthrough if 'all' or anything else, but I removed 'all' from type. 
    // Let's add 'all' back to type if we want to keep it?
    // User entrepot just has today/week/month/year/specific. It defaults to 'today'.
    // It actually doesn't seem to have 'all'. 
    
    return true;
  }

  getHourForCurrentTab(t: Truck): string {
    const fallback = t.createdAt || '';

    switch (this.currentTab) {
      case 'pending': {
        const iso =
          this.findHistoryDate(t, 'Analyses envoyées à l’administrateur') ||
          t.createdAt ||
          fallback;
        return this.formatHourFromIso(iso);
      }

      case 'validated': {
        // If the truck was reintegrated by admin, prefer the reintegration timestamp
        if ((t as any).advancedStatus === 'REFUSE_REINTEGRE') {
          const iso =
            (t as any).reintegratedAt ||
            this.findHistoryDate(t, 'Réintégration administrateur') ||
            this.findHistoryDate(t, 'Validation administrateur') ||
            t.createdAt ||
            fallback;
          return this.formatHourFromIso(iso);
        }

        const iso = this.findHistoryDate(t, 'Validation administrateur') || t.createdAt || fallback;
        return this.formatHourFromIso(iso);
      }

      case 'accepted': {
        const iso =
          (t as any).finalAcceptedAt ||
          this.findHistoryDate(t, 'Détails produits renseignés — Camion accepté') ||
          t.createdAt ||
          fallback;
        return this.formatHourFromIso(iso);
      }

      case 'cancelled': {
        const iso =
          (t as any).refusedAt ||
          this.findHistoryDate(t, 'Refus administrateur') ||
          t.createdAt ||
          fallback;
        return this.formatHourFromIso(iso);
      }

      case 'renvoyes': {
        const iso =
          (t as any).renvoyeAt ||
          this.findHistoryDate(t, 'Camion renvoyé par le gérant') ||
          t.createdAt ||
          fallback;
        return this.formatHourFromIso(iso);
      }

      default:
        return this.formatHourFromIso(t.createdAt || fallback);
    }
  }

  // ================================================================
  // ONGLET
  // ================================================================
  setTab(tab: 'pending' | 'validated' | 'accepted' | 'cancelled' | 'renvoyes'): void {
    this.currentTab = tab;
  }

  get filteredTrucks(): Truck[] {
    const source = this.filteredTrucksBase;

    switch (this.currentTab) {
      case 'pending':
        return source.filter((t) => t.statut === 'En attente');

      case 'validated':
        return source.filter(
          (t: any) => t.statut === 'Validé' && t.advancedStatus !== 'ACCEPTE_FINAL'
        );

      case 'accepted':
        return source.filter((t: any) => t.advancedStatus === 'ACCEPTE_FINAL');

      case 'cancelled':
        return source.filter(
          (t: any) => t.statut === 'Annulé' && t.advancedStatus !== 'REFUSE_RENVOYE'
        );

      case 'renvoyes':
        return source.filter(
          (t: any) => t.statut === 'Annulé' && t.advancedStatus === 'REFUSE_RENVOYE'
        );

      default:
        return [];
    }
  }

  get filteredTrucksBase(): Truck[] {
    const search = this.searchTerm.trim().toLowerCase();

    return this.trucks.filter((t) => {
      // 🔍 recherche texte
      if (search) {
        const haystack = `${t.immatriculation} ${t.transporteur}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      const dateToUse = this.getDateForPeriod(t);
      return this.isInSelectedPeriod(dateToUse);
    });
  }

  // ================================================================
  // MODAL "VOIR PLUS"
  // ================================================================
  openDetailsModal(truck: Truck): void {
    this.selectedTruck = truck;

    // Charger le commentaire (stocké dans l'objet camion/metadata désormais)
    this.adminComment = truck.comment || '';

    // Si admin ouvre, on considère que la notification est lue
    if (truck.unreadForAdmin) {
      truck.unreadForAdmin = false;
      // Mise à jour API "silencieuse"
      this.truckService.updateTruck(truck.id, { unreadForAdmin: false }).subscribe();
    }

    this.showDetailsModal = true;
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
  }

  // ================================================================
  // VALIDATION
  // ================================================================
  validateTruck(): void {
    if (!this.selectedTruck) return;

    // Mise à jour des statuts
    const updates: Partial<Truck> = {
      statut: 'Validé',
      unreadForGerant: true,
      unreadForAdmin: false,
      comment: this.adminComment,
      history: [
        ...(this.selectedTruck.history || []),
        {
          event: 'Validation administrateur',
          by: 'admin',
          date: new Date().toISOString(),
        },
      ],
    };

    this.truckService.updateTruck(this.selectedTruck.id, updates).subscribe({
      next: () => {
        this.refreshView();
        this.closeDetailsModal();
        this.showNotification('Camion validé avec succès.');
      },
      error: (err) => alert('Erreur lors de la validation'),
    });
  }

  // ================================================================
  // REFOULEMENT
  // ================================================================
  refuseTruck(): void {
    if (!this.selectedTruck) return;

    const updates: Partial<Truck> = {
      statut: 'Annulé',
      advancedStatus: 'REFUSE_EN_ATTENTE_GERANT',
      refusedAt: new Date().toISOString(),
      unreadForGerant: true,
      unreadForAdmin: false,
      comment: this.adminComment,
      history: [
        ...(this.selectedTruck.history || []),
        {
          event: 'Refus administrateur',
          by: 'admin',
          date: new Date().toISOString(),
        },
      ],
    };

    this.truckService.updateTruck(this.selectedTruck.id, updates).subscribe({
      next: () => {
        this.refreshView();
        this.showNotification('Camion refusé (en attente gérant).');
        this.closeDetailsModal();
      },
      error: (err) => alert('Erreur lors du refus'),
    });
  }

  // ================================================================
  // RÉINTÉGRATION (ADMIN) — remet le camion dans l'état "Validé"
  // ================================================================
  reintegrateTruck(): void {
    if (!this.selectedTruck) return;

    const updates: any = {
      statut: 'Validé',
      advancedStatus: 'REFUSE_REINTEGRE',
      reintegratedAt: new Date().toISOString(),
      unreadForGerant: true,
      unreadForAdmin: false,
      comment: this.adminComment,
      history: [
        ...(this.selectedTruck.history || []),
        {
          event: 'Réintégration administrateur',
          by: 'admin',
          date: new Date().toISOString(),
        },
      ],
    };

    this.truckService.updateTruck(this.selectedTruck.id, updates).subscribe({
      next: () => {
        this.showNotification('Camion réintégré avec succès.');
        this.refreshView();
        this.closeDetailsModal();
      },
      error: () => alert('Erreur lors de la réintégration'),
    });
  }
  // ================================================================
  // HISTORIQUE (ADMIN) – même logique que côté user
  // ================================================================
  openHistoryModal(truck: Truck): void {
    this.historyTruck = truck;
    this.showHistoryModal = true;
  }

  closeHistoryModal(): void {
    this.showHistoryModal = false;
    this.historyTruck = null;
  }
  // ================================================================
  // IMPRESSION CAMION
  // ================================================================
  printSelectedTruck(): void {
    if (!this.selectedTruck) return;
    const truck = this.selectedTruck;

    const heure = this.formatHourFromIso(truck.heureArrivee);

    let bodyHtml = `
      <h2>Détails du camion</h2>
      <p><strong>Immatriculation :</strong> ${truck.immatriculation}</p>
      <p><strong>Transporteur :</strong> ${truck.transporteur}</p>
      <p><strong>Coopérative :</strong> ${truck.cooperative ?? '—'}</p>
      <p><strong>Fiche de transfert :</strong> ${truck.transfert ?? '—'}</p>
      <p><strong>KOR :</strong> ${truck.kor ?? '—'}</p>
      <p><strong>TH :</strong> ${truck.th ?? '—'}</p>
      <p><strong>Entrepôt :</strong> ${this.entrepot.nom}</p>
      <p><strong>Statut :</strong> ${truck.statut}</p>
      <p><strong>Heure d’arrivée :</strong> ${heure}</p>
    `;

    if ((truck as any).products) {
      const p = (truck as any).products;
      bodyHtml += `
        <h3>Détails opérateur</h3>
        <p><strong>Numéro de lot :</strong> ${p.numeroLot || '—'}</p>
        <p><strong>Nombre de sacs :</strong> ${p.nombreSacsDecharges || '—'}</p>
        <p><strong>Poids brut :</strong> ${p.poidsBrut || '—'}</p>
        <p><strong>Poids net :</strong> ${p.poidsNet || '—'}</p>
      `;
    }

    if (this.adminComment) {
      bodyHtml += `
        <h3>Commentaire administrateur</h3>
        <p>${this.adminComment}</p>
      `;
    }

    // optional: history summary
    if ((truck as any).history && (truck as any).history.length > 0) {
      const hist = (truck as any).history
        .map((h: any) => `<li>${h.event} — ${h.by} — ${new Date(h.date).toLocaleString()}</li>`)
        .join('');
      bodyHtml += `<h3>Historique</h3><ul>${hist}</ul>`;
    }

    const finalHtml = `
      <html>
        <head>
          <title>Impression camion</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111 }
            h2 { margin-bottom: 12px }
            h3 { margin-top: 18px; margin-bottom: 8px }
            p { margin: 6px 0 }
            ul { padding-left: 18px }
            .label { font-weight: 600 }
          </style>
        </head>
        <body>
          ${bodyHtml}
          <script>
            window.print();
            window.onafterprint = () => window.close();
          </script>
        </body>
      </html>
    `;

    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) return;
    win.document.write(finalHtml);
    win.document.close();
  }

  // ================================================================
  // STATISTIQUES
  // ================================================================
  get totalCamionsArrives(): number {
    return this.filteredTrucksBase.length;
  }

  get nbPending(): number {
    return this.filteredTrucksBase.filter((t) => t.statut === 'En attente').length;
  }

  get nbValidated(): number {
    return this.filteredTrucksBase.filter(
      (t: any) => t.statut === 'Validé' && t.advancedStatus !== 'ACCEPTE_FINAL'
    ).length;
  }

  get nbReintegres(): number {
    return this.filteredTrucksBase.filter(
      (t: any) => t.statut === 'Validé' && t.advancedStatus === 'REFUSE_REINTEGRE'
    ).length;
  }

  get nbAccepted(): number {
    return this.filteredTrucksBase.filter((t: any) => t.advancedStatus === 'ACCEPTE_FINAL').length;
  }

  get nbCancelled(): number {
    return this.filteredTrucksBase.filter(
      (t: any) => t.statut === 'Annulé' && t.advancedStatus !== 'REFUSE_RENVOYE'
    ).length;
  }

  get nbRenvoyes(): number {
    return this.filteredTrucksBase.filter(
      (t: any) => t.statut === 'Annulé' && t.advancedStatus === 'REFUSE_RENVOYE'
    ).length;
  }
  isAcceptedFinal(truck: Truck): boolean {
    return truck.advancedStatus === 'ACCEPTE_FINAL';
  }

  isValidatedOnly(truck: Truck): boolean {
    return truck.statut === 'Validé' && truck.advancedStatus !== 'ACCEPTE_FINAL';
  }

  isRefused(truck: Truck): boolean {
    return truck.statut === 'Annulé';
  }

  getAdvancedStatusLabel(truck: Truck): string {
    const s = (truck as any).advancedStatus;
    if (!s) return '—';

    switch (s) {
      case 'ACCEPTE_FINAL':
        return 'Accepté définitivement';
      case 'REFUSE_EN_ATTENTE_GERANT':
        return 'Refus — en attente gérant';
      case 'REFUSE_RENVOYE':
        return 'Renvoyé';
      case 'REFUSE_REINTEGRE':
        return 'Réintégré';
      default:
        return String(s);
    }
  }

  getAdvancedStatusClass(truck: Truck): string {
    const s = (truck as any).advancedStatus;
    if (!s) return '';
    switch (s) {
      case 'ACCEPTE_FINAL':
        return 'status-pill status-pill--accepted-final';
      case 'REFUSE_EN_ATTENTE_GERANT':
        return 'status-pill status-pill--pending';
      case 'REFUSE_RENVOYE':
        return 'status-pill status-pill--renvoye';
      case 'REFUSE_REINTEGRE':
        return 'status-pill status-pill--reintegre';
      default:
        return 'status-pill';
    }
  }

  getAdvancedStatusIcon(truck: Truck): string {
    const s = (truck as any).advancedStatus;
    switch (s) {
      case 'ACCEPTE_FINAL':
        return 'assignment_turned_in';
      case 'REFUSE_EN_ATTENTE_GERANT':
        return 'pending';
      case 'REFUSE_RENVOYE':
        return 'reply';
      case 'REFUSE_REINTEGRE':
        return 'replay';
      default:
        return 'help_outline';
    }
  }

  // Unified helpers for the simple `statut` column (label / class / icon)
  getStatusLabel(truck: Truck): string {
    const s = truck.statut;
    if (!s) return '—';

    switch (s) {
      case 'Enregistré':
        return 'Enregistré';
      case 'En attente':
        return 'En attente';
      case 'Validé':
        return 'Validé';
      case 'Refoulé':
      case 'Annulé':
        return 'Refoulé';
      default:
        return String(s);
    }
  }

  getStatusClass(truck: Truck): string {
    const s = truck.statut;
    if (!s) return '';

    switch (s) {
      case 'Enregistré':
        return 'status-pill status-pill--enregistre';
      case 'En attente':
        return 'status-pill status-pill--pending';
      case 'Validé':
        return 'status-pill status-pill--validated';
      case 'Refoulé':
      case 'Annulé':
        return 'status-pill status-pill--refoule';
      default:
        return 'status-pill';
    }
  }

  getStatusIcon(truck: Truck): string {
    const s = truck.statut;
    switch (s) {
      case 'Enregistré':
        return 'save_as';
      case 'En attente':
        return 'hourglass_empty';
      case 'Validé':
        return 'check_circle';
      case 'Refoulé':
      case 'Annulé':
        return 'cancel';
      default:
        return 'help_outline';
    }
  }

  setPeriod(value: 'today' | 'week' | 'month' | 'year' | 'specific'): void {
    this.selectedPeriod = value;
    if (value !== 'specific') {
      this.filterDate = '';
    }
  }

  onDateChange(): void {
    if (this.filterDate) {
      this.setPeriod('specific');
    } else {
      this.setPeriod('today');
    }
  }
}
