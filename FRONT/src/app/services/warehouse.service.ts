import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface StoredWarehouse {
  id: number;
  name: string;
  location: string;
  imageUrl: string;
}

@Injectable({ providedIn: 'root' })
export class WarehouseService {
  private apiUrl = 'http://localhost:3000/api/warehouses';

  constructor(private http: HttpClient) {}

  getWarehouses(): Observable<StoredWarehouse[]> {
    return this.http.get<StoredWarehouse[]>(this.apiUrl);
  }

  getWarehouse(id: number): Observable<StoredWarehouse> {
    return this.http.get<StoredWarehouse>(`${this.apiUrl}/${id}`);
  }

  create(data: { name: string; location: string; imageFile?: File }): Observable<any> {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('location', data.location);

    if (data.imageFile) {
      formData.append('image', data.imageFile);
    }

    return this.http.post(this.apiUrl, formData);
  }

  update(
    id: number,
    data: {
      name: string;
      location: string;
      imageFile?: File;
    }
  ): Observable<any> {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('location', data.location);

    if (data.imageFile) {
      formData.append('image', data.imageFile);
    }

    return this.http.put(`${this.apiUrl}/${id}`, formData);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
