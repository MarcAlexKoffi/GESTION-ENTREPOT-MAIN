import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  
  // Note: If you have a token in your User object, you can inject it here using authService.getCurrentUser()?.token
  // and clone the request to add Authorization header.
  
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Unauthenticated - token expired or invalid
        authService.logout();
      }
      return throwError(() => error);
    })
  );
};
