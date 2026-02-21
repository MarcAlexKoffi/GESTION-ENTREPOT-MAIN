import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../config';

export interface Truck {
  id: number;
  entrepotId: number;
  immatriculation: string;
  transporteur: string;
  statut:
    | 'Enregistré'
    | 'En attente'
    | 'Validé'
    | 'En cours de déchargement'
    | 'Déchargé'
    | 'Annulé'
    | 'Refoulé';
  heureArrivee: string;
  heureDepart?: string | null;
  poids?: number | null;
  // Champs étendus (stockés dans metadata côté backend)
  advancedStatus?: string;
  history?: any[];
  unreadForGerant?: boolean;
  unreadForAdmin?: boolean;
  refusedAt?: string;
  renvoyeAt?: string;
  createdAt?: string;
  finalAcceptedAt?: string;
  transfert?: string;
  kor?: string;
  th?: string;
  cooperative?: string;
  comment?: string; // Commentaire admin
  products?: {
    numeroLot: string;
    nombreSacsDecharges: string;
    poidsBrut: string;
    poidsNet: string;
    type?: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class TruckService {
  private readonly apiUrl = `${environment.apiUrl}/trucks`;

  constructor(private http: HttpClient) {}

  // Récupérer les camions (option: filtre par entrepotId)
  getTrucks(entrepotId?: number): Observable<Truck[]> {
    let params = new HttpParams();
    if (entrepotId !== undefined && entrepotId !== null) {
      params = params.set('entrepotId', entrepotId.toString());
    }
    return this.http.get<Truck[]>(this.apiUrl, { params });
  }

  // Créer un camion
  createTruck(data: Partial<Truck>): Observable<Truck> {
    return this.http.post<Truck>(this.apiUrl, data);
  }

  // Mettre à jour un camion
  updateTruck(id: number, data: Partial<Truck>): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, data);
  }

  // Exporter en CSV avec filtres
  exportTrucks(filters: { search?: string; entrepotId?: string | number; date?: string; status?: string }): Observable<Blob> {
    let params = new HttpParams();

    if (filters.search) {
      params = params.set('search', filters.search);
    }
    if (filters.entrepotId !== undefined && filters.entrepotId !== 'all') {
      params = params.set('entrepotId', filters.entrepotId.toString());
    }
    if (filters.date) {
      params = params.set('date', filters.date);
    }
    if (filters.status && filters.status !== 'all') {
      params = params.set('status', filters.status);
    }

    // responseType: 'blob' est crucial pour télécharger un fichier binaire/texte
    return this.http.get(`${this.apiUrl}/export`, { params, responseType: 'blob' });
  }

  // Supprimer un camion
  deleteTruck(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
