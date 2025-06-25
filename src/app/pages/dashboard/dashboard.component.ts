import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, HttpClientModule, SidebarComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  totalProductos = 0;
  totalUsuarios = 0;
  totalFacturas = 0;
  ventasTotales = 0;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargarDesdeCache();
  }

  async cargarKPIs(forzar = false) {
    try {
      const [productos, usuarios, facturas] = await Promise.all([
        firstValueFrom(this.http.get<any[]>('https://adminrest.runasp.net/api/gestion/productos')),
        firstValueFrom(this.http.get<any[]>('https://adminrest.runasp.net/api/gestion/usuarios')),
        firstValueFrom(this.http.get<any[]>('https://adminrest.runasp.net/api/gestion/facturas'))
      ]);
      this.totalProductos = productos.length;
      this.totalUsuarios = usuarios.length;
      this.totalFacturas = facturas.length;
      this.ventasTotales = facturas.reduce((total, f) => total + (f.fac_total || 0), 0);

      const cache = {
        timestamp: Date.now(),
        productos,
        usuarios,
        facturas
      };
      localStorage.setItem('dashboardCache', JSON.stringify(cache));
    } catch (error) {
      alert('❌ Error al cargar los indicadores');
    }
  }

  cargarDesdeCache() {
    const cacheRaw = localStorage.getItem('dashboardCache');
    if (cacheRaw) {
      const cache = JSON.parse(cacheRaw);
      const expirado = Date.now() - cache.timestamp > 10 * 60 * 1000;
      if (!expirado) {
        this.totalProductos = cache.productos.length;
        this.totalUsuarios = cache.usuarios.length;
        this.totalFacturas = cache.facturas.length;
        this.ventasTotales = cache.facturas.reduce((total: number, f: any) => total + (f.fac_total || 0), 0);
        return;
      }
    }
    this.cargarKPIs();
  }

  refrescar() {
    this.cargarKPIs(true);
  }
}
