import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';

import { TruckService, Truck } from '../services/truck.service';
import { WarehouseService, StoredWarehouse } from '../services/warehouse.service';

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
  // Modales
  showEditModal = false;
  showAnalysisModal = false;
  showProductsModal = false;
  showHistoryModal = false;
  showModal = false;
  showSuccessBanner = false;
  showDetailsModal = false;

  // Validation States
  isAnalysisInvalid = false;
  analysisError = '';

  selectedTruckForHistory: UITruck | null = null;

  // ... (skipping unchanged properties)

  // =========================================================
  // ANALYSES
  // =========================================================
  openAnalysisModal(t: UITruck) {
    if (t.unreadForGerant) {
      t.unreadForGerant = false;
      this.truckService.updateTruck(t.id, { unreadForGerant: false }).subscribe();
    }
    this.selectedTruckForAnalysis = t;
    this.analysisData = { kor: t.kor ?? '', th: t.th ?? '' };

    // Reset validation state
    this.isAnalysisInvalid = false;
    this.analysisError = '';

    this.showAnalysisModal = true;
  }

  submitAnalysis() {
    if (!this.selectedTruckForAnalysis) return;

    // VALIDATION: KOR et TH obligatoires et numériques
    // Use String(...) to ensure we can trim, and handle potential numbers from backend/input
    const k = String(this.analysisData.kor || '').trim();
    const h = String(this.analysisData.th || '').trim();

    this.isAnalysisInvalid = false;
    this.analysisError = '';

    if (!k || !h) {
      this.isAnalysisInvalid = true;
      this.analysisError = 'Veuillez renseigner le KOR et le TH.';
      return;
    }

    if (isNaN(Number(k)) || isNaN(Number(h))) {
      this.isAnalysisInvalid = true;
      this.analysisError = 'Le KOR et le TH doivent être des valeurs numériques.';
      return;
    }

    const t = this.selectedTruckForAnalysis;
    // Local update
    t.kor = k;
    t.th = h;
    t.statut = 'En attente';

    this.addHistory(t, 'Analyses envoyées à l’administrateur');

    // API
    const updates: Partial<Truck> = {
      kor: t.kor,
      th: t.th,
      statut: 'En attente',
      history: t.history,
    };

    this.truckService.updateTruck(t.id, updates).subscribe({
      next: () => {
        this.showAnalysisModal = false;
        this.refreshView();
      },
      error: () => alert('Erreur envoi analyses'),
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
  analysisData = { kor: '', th: '' };

  productForm = {
    numeroCamion: '',
    numeroFicheTransfert: '',
    numeroLot: '',
    nombreSacsDecharges: '',
    poidsBrut: '',
    poidsNet: '',
    kor: '',
  };

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private truckService = inject(TruckService);
  private warehouseService = inject(WarehouseService);

  constructor() {}
  // ===============================
  // FILTRES (toolbar)
  // ===============================
  filterSearch = '';
  selectedPeriod: 'today' | 'week' | 'month' | 'year' | 'specific' = 'today';
  selectedStatus: 'all' | string = 'all';
  filterDate = '';

  showPeriodMenu = false;
  showStatusMenu = false;
  
  filteredTrucks: UITruck[] = [];

  get periodLabel(): string {
    switch (this.selectedPeriod) {
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

  togglePeriodMenu(): void {
    this.showPeriodMenu = !this.showPeriodMenu;
    this.showStatusMenu = false;
  }

  toggleStatusMenu(): void {
    this.showStatusMenu = !this.showStatusMenu;
    this.showPeriodMenu = false;
  }

  setPeriod(p: 'today' | 'week' | 'month' | 'year' | 'specific'): void {
    this.selectedPeriod = p;
    this.showPeriodMenu = false;
    
    // Clear date input if not specific, or if user switches back to presets
    if (this.selectedPeriod !== 'specific') {
       this.filterDate = '';
    }
    
    this.applyFilters();
  }

  onDateChange(): void {
    if (this.filterDate) {
      this.setPeriod('specific');
    } else {
      this.setPeriod('today');
    }
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
    const base = this.getBaseListForTab();
    const search = this.filterSearch.trim().toLowerCase();
    const now = new Date();

    const isToday = (iso: string) => {
      const d = new Date(iso);
      return d.toDateString() === now.toDateString();
    };

    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentDay = now.getDay() || 7; 
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - (currentDay - 1));

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    this.filteredTrucks = base.filter((t) => {
      // 1) Recherche
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

      // 2) Statut
      if (this.selectedStatus !== 'all') {
        if (t.statut !== this.selectedStatus) return false;
      }

      // 3) Période
      const dateToFilter = t.heureArrivee || '';
      if (!dateToFilter) return false;
      const d = new Date(dateToFilter);

      if (this.selectedPeriod === 'specific' && this.filterDate) {
        return d.toDateString() === new Date(this.filterDate).toDateString();
      }

      if (this.selectedPeriod === 'today') {
        return isToday(dateToFilter);
      }
      if (this.selectedPeriod === 'week') {
        return d >= startOfWeek;
      }
      if (this.selectedPeriod === 'month') {
        return d >= startOfMonth;
      }
      if (this.selectedPeriod === 'year') {
        return d >= startOfYear;
      }

      return true;
    });
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

    if (this.selectedPeriod === 'specific') {
      if (!this.filterDate) return true;
      return d.toDateString() === new Date(this.filterDate).toDateString();
    }

    if (this.selectedPeriod === 'today') {
      return d.toDateString() === now.toDateString();
    }
    if (this.selectedPeriod === 'week') {
      return d >= startOfWeek;
    }
    if (this.selectedPeriod === 'month') {
      return d >= startOfMonth;
    }
    if (this.selectedPeriod === 'year') {
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
    if (!this.newTruck.immatriculation.trim() || !this.newTruck.transporteur.trim()) {
      alert('Veuillez au moins l’immatriculation et le transporteur.');
      return;
    }

    if (!this.entrepot.id) {
      alert('Entrepôt non chargé, impossible de créer le camion.');
      return;
    }

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
          alert('Camion enregistré localement (mode hors-ligne)');
        } catch (e) {
          console.error('Failed to save truck locally', e);
          alert(err.error?.message || 'Erreur création camion');
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
    this.showEditModal = true;
  }

  saveEdit() {
    if (!this.selectedTruckForEdit) return;

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
      },
      error: () => alert('Erreur modification'),
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

    this.productForm = {
      numeroCamion: t.immatriculation ?? '',
      numeroFicheTransfert: t.transfert ?? '',
      kor: t.kor ?? '',

      numeroLot: t.products?.numeroLot ?? '',
      nombreSacsDecharges: t.products?.nombreSacsDecharges ?? '',
      poidsBrut: t.products?.poidsBrut ?? '',
      poidsNet: t.products?.poidsNet ?? '',
    };

    this.showProductsModal = true;
  }

  // Helper pour marquer comme lu lors de l'ouverture du menu contextuel
  markAsRead(t: UITruck) {
    if (t.unreadForGerant) {
      t.unreadForGerant = false;
      this.truckService.updateTruck(t.id, { unreadForGerant: false }).subscribe();
    }
  }

  saveProducts() {
    if (!this.selectedTruckForProducts) return;

    const t = this.selectedTruckForProducts;

    // Champs déjà existants dans ton camion
    t.immatriculation = (this.productForm.numeroCamion || '').trim();
    t.transfert = (this.productForm.numeroFicheTransfert || '').trim();
    t.kor = (this.productForm.kor || '').trim();

    // Champs produits
    const toStr = (v: any) => String(v ?? '').trim();

    // Champs produits (robustes même si l’input renvoie un number)
    t.products = {
      numeroLot: toStr(this.productForm.numeroLot),
      nombreSacsDecharges: toStr(this.productForm.nombreSacsDecharges),
      poidsBrut: toStr(this.productForm.poidsBrut),
      poidsNet: toStr(this.productForm.poidsNet),
    };

    // Si tu avais déjà une logique métier après validation, garde-la.
    t.advancedStatus = 'ACCEPTE_FINAL';
    t.finalAcceptedAt = new Date().toISOString();

    // Notifier l’admin
    t.unreadForAdmin = true;

    // Historique
    this.addHistory(t, 'Détails produits renseignés — Camion accepté');

    const updates: Partial<Truck> = {
      immatriculation: t.immatriculation,
      transfert: t.transfert,
      kor: t.kor,
      products: t.products,
      advancedStatus: 'ACCEPTE_FINAL',
      finalAcceptedAt: t.finalAcceptedAt,
      unreadForAdmin: true,
      history: t.history,
    };

    this.truckService.updateTruck(t.id, updates).subscribe({
      next: () => {
        this.showProductsModal = false;
        this.refreshView();
      },
      error: () => alert('Erreur sauvegarde produits'),
    });
  }

  // =========================================================
  // REFOULEMENT : RENVOYER PAR LE GÉRANT
  // =========================================================
  markAsRenvoye(t: UITruck) {
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
      next: () => this.refreshView(),
      error: () => alert('Erreur renvoi'),
    });
  }

  // =========================================================
  // HISTORIQUE
  // =========================================================
  openHistoryModal(t: UITruck) {
    this.selectedTruckForHistory = t;
    this.showHistoryModal = true;
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
        <div class="row"><span class="label">Poids net :</span> ${t.products?.poidsNet ?? ''}</div>
        <div class="row"><span class="label">KOR :</span> ${t.kor}</div>
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
    if (!s) return 'status-badge--unknown';

    switch (s) {
      case 'Enregistré':
        return 'status-badge--enregistre status-pill--enregistre';
      case 'En attente':
        return 'status-badge--pending status-pill--pending';
      case 'Validé':
        return 'status-badge--validated status-pill--validated';
      case 'Refoulé':
      case 'Annulé':
        return 'status-badge--cancelled status-pill--cancelled';
      default:
        return 'status-badge--unknown';
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
}
