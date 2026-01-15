import { Routes } from '@angular/router';
import { Login } from './login/login';
import { Dashboard } from './dashboard/dashboard';
import { DashboardMain } from './dashboard-main/dashboard-main';
import { Historique } from './historique/historique';
import { Entrepot } from './entrepot/entrepot';
import { Register } from './register/register';
import { Enregistrement } from './enregistrement/enregistrement';
import { UserDashboard } from './user-dashboard/user-dashboard';
import { UserDashboardMain } from './user-dashboard-main/user-dashboard-main';
import { UserHistorique } from './user-historique/user-historique';
import { UserEntrepot } from './user-entrepot/user-entrepot';
import { UsersManager } from './users-manager/users-manager';
import { AdminEmpotage } from './admin-empotage/admin-empotage';
import { UserEmpotage } from './user-empotage/user-empotage';
import { AdminEmpotageMain } from './admin-empotage-main/admin-empotage-main';
import { authGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
    {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full',
    },
    {
        path: 'login',
        component: Login,
        canActivate: [guestGuard]
    },
    {
        path: 'dashboard',
        component: Dashboard,
        canActivate: [authGuard],
        data: { role: 'admin' },
        children: [
            {
                path: '',
                redirectTo: 'dashboard-main',
                pathMatch: 'full',
            },
            {
                path: 'dashboard-main',
                component: DashboardMain,
            },
            {
                path: 'historique',
                component: Historique,
            },
            {
                path: 'entrepot/:id',
                component: Entrepot,
            },
            {
                path: 'userManager',
                component: UsersManager
            },
            {
                path: 'adminEmpotage/:id',
                component: AdminEmpotage
            },
            {
                path: 'adminEmpotageMain',
                component: AdminEmpotageMain
            }
        ],
    },
    {
        path: 'register',
        component: Register,
        canActivate: [guestGuard]
    },
    {
        path: 'enregistrement',
        component: Enregistrement,
        // Assuming this is public or needing separate logic, leaving unguarded for now or maybe authGuard? 
        // Best to leave it open if it's the "Pointage" kiosk mode, or protect if it's internal.
        // Given past context, it often is a kiosk mode. I will leave it unguarded for now unless user asked.
    },
    {
        path: 'userdashboard',
        component: UserDashboard,
        canActivate: [authGuard],
        data: { role: 'operator' },
        children: [
            {
                path: '',
                redirectTo: 'userdashboardmain',
                pathMatch: 'full'
            },
            {
                path: 'userdashboardmain',
                component: UserDashboardMain
            },
            {
                path: 'userhistorique',
                component: UserHistorique
            },
            {
                path: 'userentrepot/:id',
                component: UserEntrepot
            },
            {
                path: 'userEmpotage',
                component: UserEmpotage
            }
        ]
    },
    {
        path: '**',
        redirectTo: 'login'
    }
];
