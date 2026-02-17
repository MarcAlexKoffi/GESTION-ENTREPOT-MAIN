import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  username = '';
  password = '';
  showPassword = false;

  errorMessage: string | null = null;
  isLoading = false;

  constructor(private router: Router, private authService: AuthService) {}

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    this.errorMessage = null;

    if (!this.username.trim() || !this.password) {
      this.errorMessage = 'Veuillez saisir votre identifiant et votre mot de passe.';
      return;
    }

    this.isLoading = true;
    this.authService.login({ username: this.username, password: this.password }).subscribe({
      next: (user) => {
        this.isLoading = false;

        if (user.role === 'admin') {
          this.router.navigate(['/dashboard/dashboard-main']);
        } else if (user.entrepotId) {
          this.router.navigate(['/userdashboard/userdashboardmain']);
        } else {
          this.errorMessage =
            "Votre compte n'a pas d'entrepôt assigné. Contactez un administrateur.";
          this.authService.logout();
        }
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 401) {
          this.errorMessage = 'Identifiant ou mot de passe incorrect.';
        } else if (err.status === 403) {
          this.errorMessage = 'Compte inactif ou suspendu.';
        } else {
          this.errorMessage = 'Erreur de connexion serveur.';
          console.error(err);
        }
      },
    });
  }
}
