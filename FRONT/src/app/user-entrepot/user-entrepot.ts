import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';

import { TruckService, Truck } from '../services/truck.service';
import { WarehouseService, StoredWarehouse } from '../services/warehouse.service';
import { ToastService } from '../services/toast.service';

type UITruck = Truck & { showMenu?: boolean };

@Component({
  selector: 'app-user-entrepot',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './user-entrepot.html',
  styleUrl: './user-entrepot.scss',
})
export class UserEntrepot implements OnInit {
  entrepot = { id: 0, nom: '', lieu: '' };

  trucks: UITruck[] = [];

  currentTab: 'enregistres' | 'attente' | 'valides' | 'refoules' | 'acceptes' | 'historique' =
    'enregistres';

  // Counts
  nbEnregistres = 0;
  nbAttente = 0;
  nbValides = 0;
  nbRefoules = 0;
  nbAcceptes = 0;
  nbHistorique = 0;

  // Modales
  showEditModal = false;
  showAnalysisModal = false;
  showProductsModal = false;
  showHistoryModal = false;
  showModal = false;
  showSuccessBanner = false;
  showDetailsModal = false;
  

  // Modale confirmation renvoi
  showRenvoyeConfirmModal = false;
  truckToRenvoyer: UITruck | undefined;

  // Validation States
  isNewTruckInvalid = false;
  isEditInvalid = false;
  isProductsInvalid = false;
  isAnalysisInvalid = false;
  analysisError = '';

  selectedTruckForHistory: UITruck | null = null;


  // =========================================================
  // ANALYSES
  // =========================================================
  openAnalysisModal(t: UITruck) {
    if (t.unreadForGerant) {
      t.unreadForGerant = false;
      this.truckService.updateTruck(t.id, { unreadForGerant: false }).subscribe();
    }
    this.selectedTruckForAnalysis = t;
    this.analysisData = { 
        kor: t.kor ?? '', 
        th: t.th ?? '',
        impurete: (t as any).impurete ?? '',
        grainage: (t as any).grainage ?? '',
        defaut: (t as any).defaut ?? ''
    };

    // Reset validation state
    this.isAnalysisInvalid = false;
    this.analysisError = '';

    this.showAnalysisModal = true;
  }

  submitAnalysis() {
    if (!this.selectedTruckForAnalysis) return;

    // VALIDATION: KOR et TH obligatoires et numériques
    const k = String(this.analysisData.kor || '').trim();
    const h = String(this.analysisData.th || '').trim();

    this.isAnalysisInvalid = false;
    this.analysisError = '';

    // check both
    if (!h || !k) {
       this.isAnalysisInvalid = true;
       return;
    }

    this.loadingAnalysis = true;

    const t = this.selectedTruckForAnalysis;
    t.kor = k; // keeping KOR if needed, but HTML doesn't show it anymore? 
               // HTML shows: TH, Impuretés, Grainage, Défectuosité. No KOR input.
               // So KOR will be empty or computed? width 'grainage' maybe?
    t.th = h;
    t.statut = 'En attente';
    
    // We might need to store impurete/grainage/defaut in the truck object.
    // If Truck interface doesn't have them, we can cast to any for now to avoid build errors.
    (t as any).impurete = (this.analysisData as any).impurete;
    (t as any).grainage = (this.analysisData as any).grainage;
    (t as any).defaut = (this.analysisData as any).defaut;

    this.addHistory(t, 'Analyses envoyées à l’administrateur');

    // API
    const updates: Partial<Truck> = {
      kor: t.kor,
      th: t.th,
      statut: 'En attente',
      history: t.history,
      // Add extras
      ...({ impurete: (t as any).impurete, grainage: (t as any).grainage, defaut: (t as any).defaut } as any)
    };

    this.truckService.updateTruck(t.id, updates).subscribe({
      next: () => {
        this.loadingAnalysis = false;
        this.showAnalysisModal = false;
        this.refreshView();
        this.toastService.success('Analyses transmises avec succès. En attente de validation.');
      },
      error: () => {
        this.loadingAnalysis = false;
        this.toastService.error('Erreur envoi analyses');
      }
    });
  }

  lastSavedStatutLabel = '';

  // Formulaires initiaux
  newTruck = {
    immatriculation: '',
    transporteur: '',
    transfert: '',
    cooperative: '',
  };

  selectedTruckForEdit: UITruck | null = null;
  selectedTruckForAnalysis: UITruck | null = null;
  selectedTruckForProducts: UITruck | null = null;
  selectedTruckForDetails: UITruck | null = null;

  editTruckData = { immatriculation: '', transporteur: '', transfert: '', cooperative: '' };
  analysisData = { kor: '', th: '', impurete: '', grainage: '', defaut: '' };

  productForm = {
    numeroCamion: '',
    numeroFicheTransfert: '',
    numeroLot: '',
    nombreSacsDecharges: '',
    poidsBrut: '',
    poidsNet: '',
    kor: '',
  };

  productsData = {
    numeroCamion: '',
    numeroFicheTransfert: '',
    numeroLot: '',
    nombreSacsDecharges: '',
    poidsBrut: '',
    poidsNet: '',
    kor: '',
    type: 'Cacao',
    comment: ''
  };
  loadingAnalysis = false;
  errorMessage = '';

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private truckService = inject(TruckService);
  private warehouseService = inject(WarehouseService);
  private toastService = inject(ToastService);

  constructor() {}
  // ===============================
  // FILTRES (toolbar)
  // ===============================
  filterSearch = '';
  period: 'today' | 'week' | 'month' | 'year' | 'specific' = 'today';
  selectedStatus: 'all' | string = 'all';
  filterDate = '';

  showStatusMenu = false;
  
  filteredTrucks: UITruck[] = [];

  get periodLabel(): string {
    switch (this.period) {
      case 'today':
        return "Aujourd'hui";
      case 'week':
        return 'Cette semaine';
      case 'month':
        return 'Ce mois';
      case 'year':
        return 'Cette année';
      case 'specific':
        return 'Date spécifique';
      default:
        return 'Toutes périodes';
    }
  }

  get statusLabel(): string {
    return this.selectedStatus === 'all' ? 'Tous statuts' : this.selectedStatus;
  }

  toggleStatusMenu(): void {
    this.showStatusMenu = !this.showStatusMenu;
  }

  onPeriodChange(): void {
    // Clear date input if not specific
    if (this.period !== 'specific') {
       this.filterDate = '';
    }
    this.applyFilters();
  }

  onDateChange(): void {
    if (this.filterDate) {
      this.period = 'specific';
    } else {
      this.period = 'today';
    }
    this.applyFilters();
  }

  setStatus(s: 'all' | string): void {
    this.selectedStatus = s;
    this.showStatusMenu = false;
    this.applyFilters();
  }

  // Ancienne logique getList() renommée en "getBaseListForTab"
  private getBaseListForTab(): UITruck[] {
    switch (this.currentTab) {
      case 'enregistres':
        return this.trucks.filter((t) => t.statut === 'Enregistré');

      case 'attente':
        return this.trucks.filter((t) => t.statut === 'En attente');

      case 'valides':
        return this.trucks.filter(
          (t) => t.statut === 'Validé' && t.advancedStatus !== 'ACCEPTE_FINAL'
        );

      case 'refoules':
        return this.trucks.filter(
          (t: any) =>
            t.statut === 'Refoulé' ||
            (t.statut === 'Annulé' &&
              (t.advancedStatus === 'REFUSE_EN_ATTENTE_GERANT' ||
                t.advancedStatus === 'REFUSE_RENVOYE'))
        );

      case 'acceptes':
        return this.trucks.filter((t) => t.advancedStatus === 'ACCEPTE_FINAL');

      case 'historique':
        return this.trucks.filter((t) => t.history && t.history.length > 0);

      default:
        return [];
    }
  }

  applyFilters(): void {
    const search = this.filterSearch.trim().toLowerCase();

    // 1. Filtrer 'tous' les camions selon Search + Période (et éventuellement selectedStatus)
    const validTrucks = this.trucks.filter((t) => {
      // a) Recherche
      if (search) {
        const haystack = (
          (t.immatriculation ?? '') +
          ' ' +
          (t.transporteur ?? '') +
          ' ' +
          (t.transfert ?? '') +
          ' ' +
          ((t as any).cooperative ?? '')
        ).toLowerCase();

        if (!haystack.includes(search)) return false;
      }

      // b) SelectedStatus (si utilisé)
      if (this.selectedStatus !== 'all') {
        if (t.statut !== this.selectedStatus) return false;
      }

      // c) Période
      const dateToFilter = this.getDateForPeriod(t);
      return this.isInSelectedPeriod(dateToFilter);
    });

    // 2. Calculer les compteurs pour chaque onglet
    this.nbEnregistres = 0;
    this.nbAttente = 0;
    this.nbValides = 0;
    this.nbRefoules = 0;
    this.nbAcceptes = 0;
    this.nbHistorique = 0;

    validTrucks.forEach((t) => {
      // Enregistrés
      if (t.statut === 'Enregistré') {
        this.nbEnregistres++;
      }
      // En attente
      if (t.statut === 'En attente') {
        this.nbAttente++;
      }
      // Validés
      if (t.statut === 'Validé' && t.advancedStatus !== 'ACCEPTE_FINAL') {
        this.nbValides++;
      }
      // Refoulés
      if (
        t.statut === 'Refoulé' ||
        (t.statut === 'Annulé' &&
          (t.advancedStatus === 'REFUSE_EN_ATTENTE_GERANT' ||
            t.advancedStatus === 'REFUSE_RENVOYE'))
      ) {
        this.nbRefoules++;
      }
      // Acceptés
      if (t.advancedStatus === 'ACCEPTE_FINAL') {
        this.nbAcceptes++;
      }
      // Historique (tout ce qui a une history)
      if (t.history && t.history.length > 0) {
        this.nbHistorique++;
      }
    });

    // 3. Définir filteredTrucks selon l'onglet courant
    switch (this.currentTab) {
      case 'enregistres':
        this.filteredTrucks = validTrucks.filter((t) => t.statut === 'Enregistré');
        break;

      case 'attente':
        this.filteredTrucks = validTrucks.filter((t) => t.statut === 'En attente');
        break;

      case 'valides':
        this.filteredTrucks = validTrucks.filter(
          (t) => t.statut === 'Validé' && t.advancedStatus !== 'ACCEPTE_FINAL'
        );
        break;

      case 'refoules':
        this.filteredTrucks = validTrucks.filter(
          (t: any) =>
            t.statut === 'Refoulé' ||
            (t.statut === 'Annulé' &&
              (t.advancedStatus === 'REFUSE_EN_ATTENTE_GERANT' ||
                t.advancedStatus === 'REFUSE_RENVOYE'))
        );
        break;

      case 'acceptes':
        this.filteredTrucks = validTrucks.filter((t) => t.advancedStatus === 'ACCEPTE_FINAL');
        break;

      case 'historique':
        this.filteredTrucks = validTrucks.filter((t) => t.history && t.history.length > 0);
        break;

      default:
        this.filteredTrucks = [];
    }
  }

  ngOnInit(): void {
    this.loadEntrepot();
  }

  private refreshView(): void {
    this.loadTrucks();
  }

  // =========================================================
  // LOCAL STORAGE FALLBACK (per warehouse)
  // =========================================================
  private loadTrucksFromStorage(): void {
    const raw = localStorage.getItem('trucks');
    const all: UITruck[] = raw ? JSON.parse(raw) : [];
    this.trucks = all
      .filter((t) => Number(t.entrepotId) === Number(this.entrepot.id))
      .map((t) => ({ ...t, showMenu: false }));

    this.trucks.forEach((t) => {
      if (!t.history) t.history = [];
      if (!t.kor) t.kor = '';
      if (!t.th) t.th = '';
      if (t.showMenu === undefined) t.showMenu = false;
    });

    this.applyFilters();
  }

  private saveTrucksToStorage(): void {
    const raw = localStorage.getItem('trucks');
    let all: UITruck[] = raw ? JSON.parse(raw) : [];

    // Remove trucks belonging to this entrepot and replace with current list
    all = all.filter((t) => Number(t.entrepotId) !== Number(this.entrepot.id));

    // Save copies without UI-only fields
    const toSave = this.trucks.map((t) => {
      const copy: any = { ...t };
      delete copy.showMenu;
      return copy;
    });

    all.push(...toSave);
    localStorage.setItem('trucks', JSON.stringify(all));
  }

  // =========================================================
  // CHARGEMENT ENTREPT
  // =========================================================
  loadEntrepot(): void {
    const idParam = Number(this.route.snapshot.paramMap.get('id'));

    this.warehouseService.getWarehouse(idParam).subscribe({
      next: (w) => {
        this.entrepot = { id: w.id, nom: w.name, lieu: w.location };
        try {
          localStorage.setItem('lastVisitedEntrepot', String(this.entrepot.id));
        } catch (e) {
          /* ignore */
        }
        // maintenant que l'entrepôt est chargé, charger les camions
        this.loadTrucks();
      },
      error: (err: any) => {
        console.error('Erreur chargement entrepôt', err);
        // fallback to local storage if API fails
        try {
          const raw = localStorage.getItem('warehouses');
          const warehouses: StoredWarehouse[] = raw ? JSON.parse(raw) : [];
          const found = warehouses.find((w) => w.id === idParam) ?? warehouses[0];
          if (found) {
            this.entrepot = { id: found.id, nom: found.name, lieu: found.location };
          }
        } catch (e) {
          // ignore parsing errors
        }
        this.loadTrucksFromStorage();
      },
    });
  }

  loadTrucks(): void {
    this.truckService.getTrucks(this.entrepot.id).subscribe({
      next: (data) => {
        // Force filter by entrepotId in case backend returns extras
        const filtered = (data || []).filter(
          (t) => Number(t.entrepotId) === Number(this.entrepot.id)
        );
        this.trucks = filtered.map((t) => ({ ...t, showMenu: false }));
        this.applyFilters();
        // persist a local copy per-warehouse
        try {
          this.saveTrucksToStorage();
        } catch (e) {
          console.warn('Could not save trucks to localStorage', e);
        }
        console.log(
          '[user-entrepot] loadTrucks - after applyFilters, filteredTrucks.length=',
          this.filteredTrucks.length
        );
      },
      error: (err) => {
        console.error('Erreur loading trucks, falling back to localStorage', err);
        this.loadTrucksFromStorage();
      },
    });
  }

  // saveTrucks supprimé (remplacé par API)

  // =========================================================
  // HISTORIQUE
  // =========================================================
  // =========================================================
  // HISTORIQUE
  // =========================================================
  addHistory(t: UITruck, event: string) {
    if (!t.history) t.history = [];
    t.history.push({
      event,
      by: 'gerant',
      date: new Date().toISOString(),
    });
  }

  // =========================================================
  // ONGLET LISTES
  // =========================================================
  setTab(tab: 'enregistres' | 'attente' | 'valides' | 'refoules' | 'acceptes' | 'historique'): void {
    this.currentTab = tab;
    this.applyFilters();
    // Rafraîchissement silencieux des données
    this.loadTrucks();
  }

  trackById(index: number, item: UITruck): number {
    return item.id;
  }

  getList(): UITruck[] {
    const source = this.trucksByPeriod;

    switch (this.currentTab) {
      case 'enregistres':
        return source.filter((t) => t.statut === 'Enregistré');

      case 'attente':
        return source.filter((t) => t.statut === 'En attente');

      case 'valides':
        return source.filter((t) => t.statut === 'Validé' && t.advancedStatus !== 'ACCEPTE_FINAL');

      case 'refoules':
        return source.filter(
          (t: any) =>
            t.statut === 'Refoulé' ||
            (t.statut === 'Annulé' &&
              (t.advancedStatus === 'REFUSE_EN_ATTENTE_GERANT' ||
                t.advancedStatus === 'REFUSE_RENVOYE'))
        );

      case 'acceptes':
        return source.filter((t) => t.advancedStatus === 'ACCEPTE_FINAL');

      case 'historique':
        return source.filter((t) => t.history && t.history.length > 0);

      default:
        return [];
    }
  }
  get trucksByPeriod(): UITruck[] {
    // Prefer `createdAt` when available (ISO), otherwise fall back to `heureArrivee` (time-only)
    // Use a helper to pick the most relevant timestamp depending on recent actions (refus, renvoi, réintégration, acceptation...)
    return this.trucks.filter((t) => {
      const dateToUse = this.getDateForPeriod(t);
      return this.isInSelectedPeriod(dateToUse);
    });
  }

  // Choose the most relevant timestamp for period filtering and display (user-side)
  private getDateForPeriod(truck: UITruck): string {
    try {
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

      if ((truck as any).advancedStatus === 'ACCEPTE_FINAL') {
        return (
          (truck as any).finalAcceptedAt ||
          this.findHistoryDate(truck, 'Détails produits renseignés — Camion accepté') ||
          (truck as any).createdAt ||
          truck.heureArrivee ||
          ''
        );
      }

      if ((truck as any).advancedStatus === 'REFUSE_REINTEGRE') {
        return (
          (truck as any).reintegratedAt ||
          this.findHistoryDate(truck, 'Réintégration administrateur') ||
          (truck as any).createdAt ||
          truck.heureArrivee ||
          ''
        );
      }

      if (truck.statut === 'Validé') {
        return (
          (truck as any).validatedAt ||
          this.findHistoryDate(truck, 'Validation administrateur') ||
          (truck as any).createdAt ||
          truck.heureArrivee ||
          ''
        );
      }

      if (truck.statut === 'En attente') {
        return (
          this.findHistoryDate(truck, 'Analyses envoyées à l’administrateur') ||
          (truck as any).createdAt ||
          truck.heureArrivee ||
          ''
        );
      }

      return (truck as any).createdAt || truck.heureArrivee || '';
    } catch (e) {
      return (truck as any).createdAt || truck.heureArrivee || '';
    }
  }

  private isInSelectedPeriod(dateIso: string): boolean {
    if (!dateIso) return false;
    const d = new Date(dateIso);
    const now = new Date();

    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentDay = now.getDay() || 7; 
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - (currentDay - 1));

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    if (this.period === 'specific') {
      if (!this.filterDate) return true;
      return d.toDateString() === new Date(this.filterDate).toDateString();
    }

    if (this.period === 'today') {
      return d.toDateString() === now.toDateString();
    }
    if (this.period === 'week') {
      return d >= startOfWeek;
    }
    if (this.period === 'month') {
      return d >= startOfMonth;
    }
    if (this.period === 'year') {
      return d >= startOfYear;
    }

    return true; 
  }

  // =========================================================
  // HEURE PAR CATÉGORIE (affichée dans la colonne "Heure")
  // =========================================================
  private formatHourFromIso(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private findHistoryDate(truck: UITruck, event: string): string | undefined {
    const list = truck.history || [];
    // On cherche la dernière occurrence de cet event (plus récent)
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i]?.event === event && list[i]?.date) return list[i].date;
    }
    return undefined;
  }

  /** Heure à afficher selon l’onglet actif */
  getHourForCurrentTab(t: UITruck): string {
    // fallback : heureArrivee (ancienne logique) si vraiment rien
    const fallback = t.createdAt || '';

    switch (this.currentTab) {
      case 'enregistres': {
        const iso = this.findHistoryDate(t, 'Camion enregistré') || t.createdAt || fallback;
        return this.formatHourFromIso(iso);
      }

      case 'attente': {
        const iso =
          this.findHistoryDate(t, 'Analyses envoyées à l’administrateur') ||
          t.createdAt ||
          fallback;
        return this.formatHourFromIso(iso);
      }

      case 'valides': {
        // If the truck was reintegrated by admin, prefer the reintegration timestamp
        if ((t as any).advancedStatus === 'REFUSE_REINTEGRE') {
          const iso =
            (t as any).reintegratedAt ||
            this.findHistoryDate(t, 'Réintégration administrateur') ||
            (t as any).validatedAt ||
            this.findHistoryDate(t, 'Validation administrateur') ||
            t.createdAt ||
            fallback;
          return this.formatHourFromIso(iso);
        }

        const iso =
          // si tu remplis un jour validatedAt, il sera prioritaire
          (t as any).validatedAt ||
          this.findHistoryDate(t, 'Validation administrateur') ||
          t.createdAt ||
          fallback;
        return this.formatHourFromIso(iso);
      }

      case 'refoules': {
        const iso =
          (t as any).refusedAt ||
          this.findHistoryDate(t, 'Refus administrateur') ||
          t.createdAt ||
          fallback;
        return this.formatHourFromIso(iso);
      }

      case 'acceptes': {
        const iso =
          t.finalAcceptedAt ||
          this.findHistoryDate(t, 'Détails produits renseignés — Camion accepté') ||
          t.createdAt ||
          fallback;
        return this.formatHourFromIso(iso);
      }

      case 'historique': {
        const last =
          t.history && t.history.length > 0 ? t.history[t.history.length - 1]?.date : undefined;
        return this.formatHourFromIso(last || t.createdAt || fallback);
      }

      default:
        return this.formatHourFromIso(t.createdAt || fallback);
    }
  }

  // =========================================================
  // AJOUT CAMION
  // =========================================================
  openModal() {
    this.showSuccessBanner = false;
    this.isNewTruckInvalid = false;
    this.errorMessage = '';
    this.newTruck = {
      immatriculation: '',
      transporteur: '',
      transfert: '',
      cooperative: '',
    };
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  saveTruck() {
    this.isNewTruckInvalid = false;
    // Tous les champs sont requis
    if (
      !this.newTruck.immatriculation.trim() ||
      !this.newTruck.transporteur.trim() ||
      !this.newTruck.transfert.trim() ||
      !this.newTruck.cooperative.trim()
    ) {
      this.isNewTruckInvalid = true;
      return;
    }

    if (!this.entrepot.id) {
      this.toastService.error('Entrepôt non chargé, impossible de créer le camion.');
      return;
    }

    // --- CHECK DUPLICATE (Immat OR Transfert + Date) ---
    const checkImmat = this.newTruck.immatriculation.trim().toLowerCase();
    const checkTransfert = this.newTruck.transfert.trim().toLowerCase();
    const todayStr = new Date().toDateString();

    this.errorMessage = '';

    const duplicate = this.trucks.find((t) => {
      const tImmat = (t.immatriculation || '').trim().toLowerCase();
      const tTrans = (t.transfert || '').trim().toLowerCase();
      
      const tDate = t.heureArrivee ? new Date(t.heureArrivee) : (t.createdAt ? new Date(t.createdAt) : null);
      if (!tDate) return false;

      if (tDate.toDateString() !== todayStr) return false;

      // Check if Immat is duplicate
      if (checkImmat && tImmat === checkImmat) return true;
      // Check if Transfert is duplicate (if not empty)
      if (checkTransfert && tTrans === checkTransfert) return true;

      return false;
    });

    if (duplicate) {
      this.errorMessage = "Doublon : cette immatriculation ou cette fiche de transfert a déjà été enregistrée aujourd'hui.";
      return;
    }
    // --------------------------------------------------------

    const now = new Date();
    // note: 'Enregistré' n'est pas dans le type strict, on triche ou on change le type
    const statutInit = 'Enregistré' as any;

    const truckPayload: Partial<Truck> = {
      entrepotId: this.entrepot.id,
      immatriculation: this.newTruck.immatriculation.trim(),
      transporteur: this.newTruck.transporteur.trim(),
      transfert: this.newTruck.transfert.trim(),
      cooperative: this.newTruck.cooperative.trim(),

      kor: '',
      th: '',

      statut: statutInit,
      // FIX: Use full ISO string instead of just time, so simple date filtering (new Date(ts)) works immediately
      heureArrivee: now.toISOString(),
      history: [{ event: 'Camion enregistré', by: 'gerant', date: now.toISOString() }],
    };

    console.log('Sending payload:', truckPayload);

    this.truckService.createTruck(truckPayload).subscribe({
      next: (created) => {
        // Backend may return only { id: ... } — build a full UI truck locally
        const nowIso = new Date().toISOString();
        const uiTruck: UITruck = {
          id: (created && (created as any).id) || Math.floor(Math.random() * -1000000),
          entrepotId: truckPayload.entrepotId!,
          immatriculation: (truckPayload.immatriculation as string) || '',
          transporteur: (truckPayload.transporteur as string) || '',
          transfert: (truckPayload.transfert as string) || '',
          cooperative: (truckPayload.cooperative as string) || '',
          kor: truckPayload.kor || '',
          th: truckPayload.th || '',
          statut: (truckPayload.statut as any) || ('Enregistré' as any),
          heureArrivee: truckPayload.heureArrivee || nowIso,
          history: truckPayload.history || [],
          createdAt: nowIso,
          showMenu: false,
        };

        // Insert at top and refresh filters/stats
        this.trucks = [uiTruck, ...this.trucks];
        this.applyFilters();

        // Persist locally as well so each entrepot keeps its own list
        try {
          this.saveTrucksToStorage();
        } catch (e) {
          console.warn('Could not save created truck to localStorage', e);
        }

        this.lastSavedStatutLabel = 'Enregistré';
        this.showSuccessBanner = true;
        setTimeout(() => {
          this.showModal = false;
          this.showSuccessBanner = false;
        }, 1200);
      },
      error: (err) => {
        console.error('API createTruck failed, saving locally', err);
        // Fallback: save locally so this entrepot still sees its trucks
        const nowIso = new Date().toISOString();
        const uiTruck: UITruck = {
          id: Math.floor(Math.random() * -1000000),
          entrepotId: truckPayload.entrepotId!,
          immatriculation: (truckPayload.immatriculation as string) || '',
          transporteur: (truckPayload.transporteur as string) || '',
          transfert: (truckPayload.transfert as string) || '',
          cooperative: (truckPayload.cooperative as string) || '',
          kor: truckPayload.kor || '',
          th: truckPayload.th || '',
          statut: (truckPayload.statut as any) || ('Enregistré' as any),
          heureArrivee: truckPayload.heureArrivee || nowIso,
          history: truckPayload.history || [],
          createdAt: nowIso,
          showMenu: false,
        };

        this.trucks = [uiTruck, ...this.trucks];
        this.applyFilters();
        try {
          this.saveTrucksToStorage();
          this.toastService.warning('Camion enregistré localement (mode hors-ligne)');
        } catch (e) {
          console.error('Failed to save truck locally', e);
          this.toastService.error(err.error?.message || 'Erreur création camion');
        }
      },
    });
  }

  // =========================================================
  // ÉDITION CAMION
  // =========================================================
  openEditModal(t: UITruck) {
    if (t.unreadForGerant) {
      t.unreadForGerant = false;
      this.truckService.updateTruck(t.id, { unreadForGerant: false }).subscribe();
    }
    this.selectedTruckForEdit = t;
    this.editTruckData = {
      immatriculation: t.immatriculation,
      transporteur: t.transporteur,
      transfert: t.transfert || '',
      cooperative: t.cooperative || '',
    };
    this.isEditInvalid = false;
    this.showEditModal = true;
  }

  saveEdit() {
    if (!this.selectedTruckForEdit) return;

    this.isEditInvalid = false;
    if (
      !this.editTruckData.immatriculation.trim() ||
      !this.editTruckData.transporteur.trim() ||
      !this.editTruckData.transfert.trim() ||
      !this.editTruckData.cooperative.trim()
    ) {
      this.isEditInvalid = true;
      return;
    }

    const t = this.selectedTruckForEdit;
    // Mise à jour locale pour l'historique
    t.immatriculation = this.editTruckData.immatriculation.trim();
    t.transporteur = this.editTruckData.transporteur.trim();
    t.transfert = this.editTruckData.transfert.trim();
    t.cooperative = this.editTruckData.cooperative.trim();

    this.addHistory(t, 'Modification des informations');

    // API call
    const updates: Partial<Truck> = {
      immatriculation: t.immatriculation,
      transporteur: t.transporteur,
      transfert: t.transfert,
      cooperative: t.cooperative,
      history: t.history,
    };

    this.truckService.updateTruck(t.id, updates).subscribe({
      next: () => {
        this.showEditModal = false;
        this.refreshView();
        this.toastService.success('Modifications enregistrées avec succès.');
      },
      error: () => this.toastService.error('Erreur modification'),
    });
  }

  // =========================================================
  // PRODUITS (APRÈS VALIDATION)
  // =========================================================
  openProductsModal(t: UITruck) {
    if (t.unreadForGerant) {
      t.unreadForGerant = false;
      this.truckService.updateTruck(t.id, { unreadForGerant: false }).subscribe();
    }
    this.selectedTruckForProducts = t;

    this.productsData = {
      numeroCamion: t.immatriculation || '',
      numeroFicheTransfert: t.transfert || '',
      numeroLot: t.products?.numeroLot || '',
      nombreSacsDecharges: t.products?.nombreSacsDecharges || '',
      poidsBrut: t.products?.poidsBrut || '',
      poidsNet: t.products?.poidsNet || '',
      kor: t.kor || '',
      type: (t.products as any)?.type || 'Cacao',
      comment: (t.products as any)?.comment || ''
    };

    this.isProductsInvalid = false;
    this.showProductsModal = true;
  }

  // Helper pour marquer comme lu lors de l'ouverture du menu contextuel
  markAsRead(t: UITruck) {
    if (t.unreadForGerant) {
      t.unreadForGerant = false;
      this.truckService.updateTruck(t.id, { unreadForGerant: false }).subscribe();
    }
  }

  submitProducts() {
    if (!this.selectedTruckForProducts) return;

    this.isProductsInvalid = false;
    // Validate all fields
    if (
      !this.productsData.numeroFicheTransfert.toString().trim() ||
      !this.productsData.numeroLot.toString().trim() ||
      !this.productsData.type.toString().trim() ||
      !this.productsData.nombreSacsDecharges ||
      Number(this.productsData.nombreSacsDecharges) <= 0 ||
      !this.productsData.poidsBrut ||
      Number(this.productsData.poidsBrut) <= 0 ||
      !this.productsData.poidsNet ||
      Number(this.productsData.poidsNet) <= 0 ||
      !this.productsData.kor ||
      Number(this.productsData.kor) <= 0
    ) {
      this.isProductsInvalid = true;
      return;
    }

    const t = this.selectedTruckForProducts;
    
    // Construct new products object
    const prod = {
        poidsBrut: String(this.productsData.poidsBrut), 
        poidsNet: String(this.productsData.poidsNet),
        nombreSacsDecharges: String(this.productsData.nombreSacsDecharges),
        numeroLot: String(this.productsData.numeroLot),
        type: this.productsData.type,
        comment: this.productsData.comment
    };

    t.products = prod;
    // Update simple properties if editable
    t.transfert = this.productsData.numeroFicheTransfert;
    t.kor = String(this.productsData.kor);

    t.advancedStatus = 'ACCEPTE_FINAL';
    t.finalAcceptedAt = new Date().toISOString();
    t.unreadForAdmin = true;

    this.addHistory(t, 'Détails produits renseignés — Camion accepté');

    const updates: Partial<Truck> = {
      products: t.products,
      transfert: t.transfert,
      kor: t.kor,
      advancedStatus: 'ACCEPTE_FINAL',
      finalAcceptedAt: t.finalAcceptedAt,
      unreadForAdmin: true,
      history: t.history,
    };

    this.truckService.updateTruck(t.id, updates).subscribe({
      next: () => {
        this.showProductsModal = false;
        this.refreshView();
        this.toastService.success('Produits enregistrés. Camion accepté définitivement.');
      },
      error: () => this.toastService.error('Erreur sauvegarde produits'),
    });
  }

  // =========================================================
  // REFOULEMENT : RENVOYER PAR LE GÉRANT
  // =========================================================
  markAsRenvoye(t: UITruck) {
    this.truckToRenvoyer = t;
    this.showRenvoyeConfirmModal = true;
  }

  closeRenvoyeConfirmModal() {
    this.showRenvoyeConfirmModal = false;
    this.truckToRenvoyer = undefined;
  }

  confirmRenvoye() {
    if (!this.truckToRenvoyer) return;
    const t = this.truckToRenvoyer;

    //  Assure la compatibilité admin : l’admin classe par statut "Annulé"
    t.statut = 'Annulé';

    // Statut avancé : renvoyé
    t.advancedStatus = 'REFUSE_RENVOYE';
    t.renvoyeAt = new Date().toISOString();

    // Notifier l’admin
    t.unreadForAdmin = true;

    this.addHistory(t, 'Camion renvoyé par le gérant');

    const updates: Partial<Truck> = {
      statut: 'Annulé',
      advancedStatus: 'REFUSE_RENVOYE',
      renvoyeAt: t.renvoyeAt,
      unreadForAdmin: true,
      history: t.history,
    };

    this.truckService.updateTruck(t.id, updates).subscribe({
      next: () => {
        this.closeRenvoyeConfirmModal();
        this.refreshView();
        this.toastService.success('Camion marqué comme renvoyé.');
      },
      error: () => this.toastService.error('Erreur renvoi'),
    });
  }

  // =========================================================
  // HISTORIQUE
  // =========================================================
  openHistoryModal(t: UITruck) {
    this.selectedTruckForHistory = t;
    this.showHistoryModal = true;
  }

  openDetails(t: UITruck) {
     this.openDetailsModal(t);
  }

  openDetailsModal(t: UITruck) {
    this.selectedTruckForDetails = t;
    this.showDetailsModal = true;
  }

  printSelectedTruck() {
    if (!this.selectedTruckForDetails) return;

    const t = this.selectedTruckForDetails;

    const html = `
    <html>
      <head>
        <title>Fiche camion</title>
        <style>
          body { font-family: Arial; padding: 24px; }
          h2 { margin-bottom: 16px; }
          .row { margin-bottom: 8px; }
          .label { font-weight: bold; }
        </style>
      </head>
      <body>
        <h2>Fiche camion acceptée</h2>
        <div class="row"><span class="label">Camion :</span> ${t.immatriculation}</div>
        <div class="row"><span class="label">Transfert :</span> ${t.transfert}</div>
        <div class="row"><span class="label">Lot :</span> ${t.products?.numeroLot ?? ''}</div>
        <div class="row"><span class="label">Sacs :</span> ${
          t.products?.nombreSacsDecharges ?? ''
        }</div>
        <div class="row"><span class="label">Poids brut :</span> ${
          t.products?.poidsBrut ?? ''
        }</div>
        <div class="row"><span class="label">Poids net :</span> ${t.products?.poidsNet ?? ''} Kg</div>
        <div class="row"><span class="label">KOR :</span> ${t.kor}</div>
        <div class="row"><span class="label">Type produit :</span> ${(t.products as any)?.type ?? ''}</div>
        <div class="row"><span class="label">Commentaire :</span> ${(t.products as any)?.comment ?? '—'}</div>
        <script>window.print()</script>
      </body>
    </html>
  `;

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  // =========================================================
  // STATISTIQUES
  // =========================================================
  get totalEnregistres() {
    return this.trucksByPeriod.filter((t) => t.statut === 'Enregistré').length;
  }
  get totalEnAttente() {
    return this.trucksByPeriod.filter((t) => t.statut === 'En attente').length;
  }
  get totalValides() {
    // Validés = Validé mais pas encore accepté
    return this.trucksByPeriod.filter((t) => t.statut === 'Validé').length;
  }

  get totalAcceptes() {
    return this.trucksByPeriod.filter((t) => t.advancedStatus === 'ACCEPTE_FINAL').length;
  }
  get totalRefoules() {
    return this.trucksByPeriod.filter(
      (t: any) =>
        t.statut === 'Refoulé' ||
        (t.statut === 'Annulé' &&
          (t.advancedStatus === 'REFUSE_EN_ATTENTE_GERANT' ||
            t.advancedStatus === 'REFUSE_RENVOYE'))
    ).length;
  }

  get historique() {
    return this.trucks.filter((t) => t.history && t.history.length > 0);
  }

  get nbValidesByPeriod(): number {
    return this.trucksByPeriod.filter(
      (t) => t.statut === 'Validé' && t.advancedStatus !== 'ACCEPTE_FINAL'
    ).length;
  }

  get nbEnregistresByPeriod(): number {
    return this.trucksByPeriod.filter((t) => t.statut === 'Enregistré').length;
  }

  get nbAttenteByPeriod(): number {
    return this.trucksByPeriod.filter((t) => t.statut === 'En attente').length;
  }

  get nbRefoulesByPeriod(): number {
    return this.trucksByPeriod.filter(
      (t: any) =>
        t.statut === 'Refoulé' ||
        (t.statut === 'Annulé' &&
          (t.advancedStatus === 'REFUSE_EN_ATTENTE_GERANT' ||
            t.advancedStatus === 'REFUSE_RENVOYE'))
    ).length;
  }

  get nbAcceptesByPeriod(): number {
    return this.trucksByPeriod.filter((t) => t.advancedStatus === 'ACCEPTE_FINAL').length;
  }

  getAdvancedStatusLabel(t: UITruck): string {
    const sRaw = (t as any).advancedStatus;
    const s = String(sRaw ?? '').trim();
    if (!s) return '—';

    const map: Record<string, string> = {
      ACCEPTE_FINAL: 'Accepté définitivement',
      REFUSE_EN_ATTENTE_GERANT: 'En attente du gérant',
      REFUSE_RENVOYE: 'Renvoyé',
      REFUSE_REINTEGRE: 'Réintégré',
    };

    if (map[s]) return map[s];

    // Fallback: make the code human-readable (underscores -> spaces, Title Case)
    return s
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());
  }

  getAdvancedStatusClass(t: UITruck): string {
    const sRaw = (t as any).advancedStatus;
    const s = String(sRaw ?? '').trim();
    if (!s) return 'adv-badge--unknown';

    // explicit known mappings
    const map: Record<string, string> = {
      ACCEPTE_FINAL: 'adv-badge--accepted',
      REFUSE_EN_ATTENTE_GERANT: 'adv-badge--refused-wait',
      REFUSE_RENVOYE: 'adv-badge--renvoye',
      REFUSE_REINTEGRE: 'adv-badge--reintegre',
    };
    if (map[s]) return map[s];

    // heuristic fallback based on keywords
    const upper = s.toUpperCase();
    if (upper.includes('ACCEP') || upper.includes('ACCEPT')) return 'adv-badge--accepted';
    if (upper.includes('RENVOY') || upper.includes('RENVOYE')) return 'adv-badge--renvoye';
    if (upper.includes('REINT') || upper.includes('REINTEG')) return 'adv-badge--reintegre';
    if (upper.includes('ATTENT') || upper.includes('WAIT')) return 'adv-badge--refused-wait';

    return 'adv-badge--unknown';
  }

  getAdvancedStatusIcon(t: UITruck): string {
    const sRaw = (t as any).advancedStatus;
    const s = String(sRaw ?? '').trim();

    const map: Record<string, string> = {
      ACCEPTE_FINAL: 'task_alt',
      REFUSE_EN_ATTENTE_GERANT: 'hourglass_top',
      REFUSE_RENVOYE: 'send_to_mobile',
      REFUSE_REINTEGRE: 'autorenew',
    };
    if (map[s]) return map[s];

    // heuristics for unknown values -> pick a reasonable icon
    const upper = s.toUpperCase();
    if (!s) return 'help_outline';
    if (upper.includes('ACCEP') || upper.includes('ACCEPT')) return 'task_alt';
    if (upper.includes('RENVOY') || upper.includes('RENVOYE') || upper.includes('RENV'))
      return 'send_to_mobile';
    if (upper.includes('REINT') || upper.includes('REINTEG')) return 'autorenew';
    if (upper.includes('ATTENT') || upper.includes('WAIT')) return 'hourglass_top';
    if (upper.includes('REFUS') || upper.includes('REFUSE')) return 'cancel';

    return 'help_outline';
  }

  // Unified helpers for the simple `statut` column (label / class / icon)
  getStatusLabel(t: UITruck): string {
    const s = t.statut;
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

  getStatusClass(t: UITruck): string {
    const s = t.statut;
    if (!s) return 'status-pill status-pill--renvoye';

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
        return 'status-pill status-pill--renvoye';
    }
  }

  getStatusIcon(t: UITruck): string {
    const s = t.statut;
    switch (s) {
      case 'Enregistré':
        return 'post_add';
      case 'En attente':
        return 'schedule';
      case 'Validé':
        return 'check_circle';
      case 'Refoulé':
      case 'Annulé':
        return 'cancel';
      default:
        return 'help_outline';
    }
  }

  // =========================================================
  // ALIAS FOR HTML TEMPLATE COMPATIBILITY
  // =========================================================
  submitTruck() { this.saveTruck(); }
  closeEditModal() { this.showEditModal = false; }
  submitEditTruck() { this.saveEdit(); }
  closeAnalysisModal() { this.showAnalysisModal = false; }
  closeProductsModal() { this.showProductsModal = false; }
  closeHistoryModal() { this.showHistoryModal = false; }
  closeDetailsModal() { this.showDetailsModal = false; }
}
