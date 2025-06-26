import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import Chart from 'chart.js/auto';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';

@Component({
  selector: 'app-estadisticas',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, SidebarComponent],
  templateUrl: './estadisticas.component.html',
  styleUrls: ['./estadisticas.component.css']
})
export class EstadisticasComponent implements OnInit {
  API_FACTURAS = 'https://adminrest.runasp.net/api/gestion/facturas';
  API_PRODUCTOS = 'https://adminrest.runasp.net/api/gestion/productos';

  productosMap: { [key: number]: string } = {};
  ventasChart: any = null;

  desdeMes: string = '';
  hastaMes: string = '';

  cargandoMasVendido: boolean = true;
  hayDatosMasVendido = false;

  @ViewChild('masVendidoChartCanvas') masVendidoChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('ventasTotalesChartCanvas') ventasTotalesChartRef!: ElementRef<HTMLCanvasElement>;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    const hoy = new Date();
    const mesActual = hoy.toISOString().slice(0, 7);
    this.desdeMes = mesActual;
    this.hastaMes = mesActual;

    this.init();
  }

  async init() {
    try {
      await this.cargarProductos();
      await Promise.all([
        this.cargarProductoMasVendido(),
        this.cargarVentasTotales()
      ]);
    } catch (error) {
      console.error('Error inicializando estadísticas', error);
    }
  }

  async cargarProductos() {
    try {
      const productos: any = await this.http.get(this.API_PRODUCTOS).toPromise();
      productos.forEach((p: any) => {
        this.productosMap[p.id_producto] = p.pro_nombre || `Producto ${p.id_producto}`;
      });
    } catch (error) {
      console.error('❌ Error al cargar productos', error);
    }
  }

  async cargarProductoMasVendido() {
    try {
      const facturas: any = await this.http.get(this.API_FACTURAS).toPromise();
      const conteo: { [key: number]: number } = {};

      await Promise.allSettled(
        facturas.map(async (f: any) => {
          try {
            const detalles: any = await this.http.get(`https://adminrest.runasp.net/api/gestion/detallefactura/${f.id_factura}`).toPromise();
            const detallesArray = Array.isArray(detalles) ? detalles : [detalles];
            detallesArray.forEach((d: any) => {
              const id = d.id_producto;
              if (!conteo[id]) conteo[id] = 0;
              conteo[id] += d.prf_cantidad;
            });
          } catch (err) {
            console.warn(`Error cargando detalle de factura ${f.id_factura}`, err);
          }
        })
      );

      const labels = Object.keys(conteo).map(id => this.productosMap[+id] || `Producto ${id}`);
      const data = Object.values(conteo);

      const ctx = this.masVendidoChartRef.nativeElement.getContext('2d');
      if (ctx) {
        new Chart(ctx, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [{
              label: 'Unidades Vendidas',
              data: data,
              backgroundColor: '#fcb8d2'
            }]
          },
          options: {
            responsive: true,
            scales: {
              y: { beginAtZero: true }
            }
          }
        });
      }

    } catch (error) {
      console.error('❌ Error en gráfico de productos', error);
    } finally {
      this.cargandoMasVendido = false;
    }
  }

  async cargarVentasTotales() {
    try {
      if (this.desdeMes && this.hastaMes && this.desdeMes > this.hastaMes) {
        alert("La fecha 'Desde' no puede ser mayor que la fecha 'Hasta'");
        return;
      }

      const facturas: any = await this.http.get(this.API_FACTURAS).toPromise();
      const meses: { [key: string]: number } = {};

      facturas.forEach((f: any) => {
        const fecha = f.fac_fechahora || f.fac_fecha || f.fecha || null;
        if (!fecha) return;
        const mes = new Date(fecha).toISOString().slice(0, 7);
        if (this.desdeMes && mes < this.desdeMes) return;
        if (this.hastaMes && mes > this.hastaMes) return;
        if (!meses[mes]) meses[mes] = 0;
        meses[mes] += f.fac_total || 0;
      });

      const sortedMeses = Object.keys(meses).sort();
      const data = sortedMeses.map(m => meses[m]);

      const ctx = this.ventasTotalesChartRef.nativeElement.getContext('2d');
      if (ctx) {
        if (this.ventasChart) this.ventasChart.destroy();
        this.ventasChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: sortedMeses,
            datasets: [{
              label: 'Total ($)',
              data: data,
              borderColor: '#a64ac9',
              backgroundColor: '#d7aefb',
              tension: 0.3,
              fill: true,
              pointBackgroundColor: '#a64ac9'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: { beginAtZero: true }
            },
            plugins: {
              legend: {
                display: true,
                labels: { color: '#333' }
              }
            }
          }
        });
      }

    } catch (error) {
      console.error('❌ Error en gráfico de ventas', error);
    }
  }
}
