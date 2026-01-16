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
        // En cas d'erreur (serveur éteint, 404, etc...), on ne force plus la déconnexion
        // Cela permet à l'utilisateur de rester sur l'interface (même si elle est vide)
        // au lieu d'être renvoyé systématiquement au login.
        console.warn('Session verification failed but keeping session active:', error);
        return of(false);
      })
    );
  }
}
