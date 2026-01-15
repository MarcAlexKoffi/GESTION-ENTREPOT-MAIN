import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, of, catchError, map } from 'rxjs';
import { Router } from '@angular/router';
import { User } from './user.service';
import { environment } from '../config';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;
  private readonly currentUserKey = 'currentUser';

  constructor(private http: HttpClient, private router: Router) {}

  login(credentials: { username: string; password: string }): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/login`, credentials).pipe(
      tap((user) => {
        localStorage.setItem(this.currentUserKey, JSON.stringify(user));
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.currentUserKey);
    this.router.navigate(['/login']);
  }

  getCurrentUser(): User | null {
    const raw = localStorage.getItem(this.currentUserKey);
    return raw ? JSON.parse(raw) : null;
  }

  isAuthenticated(): boolean {
    return !!this.getCurrentUser();
  }

  verifySession(): Observable<boolean> {
    const user = this.getCurrentUser();
    if (!user || !user.id) {
      // If we are already on login page, don't force logout/navigate, just return false
      return of(false);
    }

    // Endpoint: /api/users/:id
    return this.http.get<User>(`${environment.apiUrl}/users/${user.id}`).pipe(
      map(updatedUser => {
        if (updatedUser && updatedUser.status === 'Actif') {
          // Update local storage to keep data fresh
           // Preserve token if you had one (current implementation doesn't seem to use bearer tokens yet, just user object)
          localStorage.setItem(this.currentUserKey, JSON.stringify(updatedUser));
          return true;
        }
        this.logout();
        return false;
      }),
      catchError((error) => {
        // Only logout if explicit authorization failure (401/403)
        // If server is down (0 or 500), keep session alive to avoid annoyance
        if (error.status === 401 || error.status === 403) {
            this.logout();
        }
        return of(false);
      })
    );
  }
}
