import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'HealthLink · Consult a Doctor',
    loadComponent: () => import('./features/consult/consult.page').then((m) => m.ConsultPage),
  },
  { path: '**', redirectTo: '' },
];
