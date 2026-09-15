import { Routes, RouterModule } from '@angular/router';
import { HomeComponent } from './components/Home/Home.component';

const appRoutes: Routes = [
  {
    path: '',
    component: HomeComponent
  },
  {
    path: 'embed',
    component: HomeComponent
  },
  {
    path: 'embed/:view',
    component: HomeComponent
  }
];

export const routing = RouterModule.forRoot(appRoutes, { enableTracing: false });
