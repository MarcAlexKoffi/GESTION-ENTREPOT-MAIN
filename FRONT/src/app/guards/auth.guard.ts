import { inject } from '@angular/core';
import { Router, CanActivateFn, RouterStateSnapshot, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  const user = authService.getCurrentUser();
  const requiredRole = route.data?.['role']; // e.g., 'admin' or 'operator'

  // If a specific role is required for this route
  if (requiredRole) {
    // If the user does not match the required role
    if (user?.role !== requiredRole) {
        // Redirect based on their actual role to their respective home
        if (user?.role === 'admin') {
            return router.createUrlTree(['/dashboard']);
        } else if (user?.role === 'operator') {
            return router.createUrlTree(['/userdashboard']);
        } else {
            // Role inconnu ou invalide => Login
            authService.logout();
            return router.createUrlTree(['/login']);
        }
    }
  }

  // If user is logged in but tries to access /login, redirect them
  // This logic is usually better placed in a separate "guest" guard, 
  // or handled in the component, but standard routes are protected here.

  return true;
};

export const guestGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.isAuthenticated()) {
        const user = authService.getCurrentUser();
        if (user?.role === 'admin') {
            return router.createUrlTree(['/dashboard']);
        } else if (user?.role === 'operator') {
            return router.createUrlTree(['/userdashboard']);
        } else {
             // Role invalide dans le localStorage -> on nettoie et on laisse passer vers login
             authService.logout();
             return true;
        }
    }
    return true;
};
