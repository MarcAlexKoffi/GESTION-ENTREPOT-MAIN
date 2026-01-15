import { Component, signal, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { LoaderComponent } from './loader/loader';
import { LoaderService } from './services/loader.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LoaderComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('GESTION-ENTREPOT');
  private router = inject(Router);
  private loaderService = inject(LoaderService);

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.loaderService.show();
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        // Petit délai pour éviter le clignotement si le chargement est trop rapide
        setTimeout(() => this.loaderService.hide(), 500);
      }
    });
  }
}
