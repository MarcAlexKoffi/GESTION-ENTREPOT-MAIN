import { Routes } from '@angular/router';
import { Login } from './login/login';
import { Dashboard } from './dashboard/dashboard';
import { DashboardMain } from './dashboard-main/dashboard-main';
import { Historique } from './historique/historique';
import { Entrepot } from './entrepot/entrepot';
import { Register } from './register/register';
import { Enregistrement } from './enregistrement/enregistrement';
import { Statistique } from './statistique/statistique';
import { UserDashboard } from './user-dashboard/user-dashboard';
import { UserDashboardMain } from './user-dashboard-main/user-dashboard-main';
import { UserHistorique } from './user-historique/user-historique';
import { UserEntrepot } from './user-entrepot/user-entrepot';
import { UsersManager } from './users-manager/users-manager';
import { AdminEmpotage } from './admin-empotage/admin-empotage';
import { UserEmpotage } from './user-empotage/user-empotage';
import { AdminEmpotageMain } from './admin-empotage-main/admin-empotage-main';

export const routes: Routes = [
    {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full',
    },
    {
        path: 'login',
        component: Login,
    },
    {
        path: 'dashboard',
        component: Dashboard,
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
                path: 'statistique',
                component: Statistique,
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
    },
    {
        path: 'enregistrement',
        component: Enregistrement,
    },
    {
        path: 'userdashboard',
        component: UserDashboard,
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
];
