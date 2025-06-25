import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';

interface Factura {
  id_factura: number;
  id_usuario: number;
  fac_descripcion: string;
  fac_fechahora: string;
  fac_subtotal: number;
  fac_total: number;
  estado_fac: 'CRE' | 'PAG' | string;
}

interface DetalleFactura {
  id_producto: number;
  prf_cantidad: number;
  prf_valor: number;
}

interface Producto {
  id_producto: number;
  pro_nombre: string;
}

interface Usuario {
  id_usuario: number;
  nombre: string;
  apellido: string;
}

@Component({
  standalone: true,
  selector: 'app-facturas',
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './facturas.component.html',
  styleUrls: ['./facturas.component.css']
})
export class FacturasComponent implements OnInit {
  API_FACTURAS = 'http://adminrest.runasp.net/api/gestion/facturas';
  API_ESTADO = 'http://adminrest.runasp.net/api/gestion/facturas/update';
  API_DETALLE = 'http://adminrest.runasp.net/api/gestion/detallefactura';
  API_PRODUCTOS = 'http://adminrest.runasp.net/api/gestion/productos';
  API_USUARIOS = 'http://adminrest.runasp.net/api/gestion/usuarios';

  facturas: Factura[] = [];
  facturasMostradas: Factura[] = [];
  cantidadPorCarga = 10;
  productosCache: Producto[] = [];
  usuariosMap: Record<number, string> = {};
  buscarTexto: string = '';
  facturaIdSeleccionada: string = '';
  usuarioSeleccionado: string = '';
  detalleFactura: Factura | null = null;
  detalleProductos: { nombre: string; cantidad: number; valor: string }[] = [];
  cargando: boolean = false;

  ngOnInit(): void {
    this.inicializarDatos();
  }

  isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  async inicializarDatos(): Promise<void> {
    this.cargando = true;
    await Promise.all([
      this.cargarProductos(),
      this.cargarUsuarios()
    ]);
    await this.cargarFacturasDesdeCacheOApi();
    this.cargando = false;
  }

  async cargarFacturasDesdeCacheOApi(): Promise<void> {
    this.cargando = true;
    let cache = '';
    let timestamp = '';

    if (this.isBrowser()) {
      cache = localStorage.getItem('facturasCache') || '';
      timestamp = localStorage.getItem('facturasCacheTime') || '';
    }

    const expiracionMs = 5 * 60 * 1000;
    const cacheValido = cache && timestamp && (Date.now() - parseInt(timestamp)) < expiracionMs;

    if (cacheValido) {
      this.facturas = JSON.parse(cache);
    } else {
      const res = await fetch(this.API_FACTURAS);
      const data: Factura[] = await res.json();
      this.facturas = data.sort((a, b) => b.id_factura - a.id_factura);
      if (this.isBrowser()) {
        localStorage.setItem('facturasCache', JSON.stringify(this.facturas));
        localStorage.setItem('facturasCacheTime', Date.now().toString());
      }
    }

    this.facturasMostradas = [];
    this.cargarMasFacturas();
    this.cargando = false;
  }

  async refrescarFacturas(): Promise<void> {
    this.cargando = true;
    if (this.isBrowser()) {
      localStorage.removeItem('facturasCache');
      localStorage.removeItem('facturasCacheTime');
    }

    const res = await fetch(this.API_FACTURAS);
    const data: Factura[] = await res.json();
    this.facturas = data.sort((a, b) => b.id_factura - a.id_factura);

    if (this.isBrowser()) {
      localStorage.setItem('facturasCache', JSON.stringify(this.facturas));
      localStorage.setItem('facturasCacheTime', Date.now().toString());
    }

    this.facturasMostradas = [];
    this.cargarMasFacturas();
    this.cargando = false;
  }

  cargarFacturas(): void {
    this.buscarTexto = '';
    this.facturaIdSeleccionada = '';
    this.usuarioSeleccionado = '';
    this.cargarFacturasDesdeCacheOApi();
  }

  async cargarProductos(): Promise<void> {
    const res = await fetch(this.API_PRODUCTOS);
    this.productosCache = await res.json();
  }

  async cargarUsuarios(): Promise<void> {
    this.usuariosMap = {};
    const res = await fetch(this.API_USUARIOS);
    const usuarios: Usuario[] = await res.json();

    for (const u of usuarios) {
      const nombre = `${u.nombre || ''} ${u.apellido || ''}`.trim();
      this.usuariosMap[u.id_usuario] = nombre || `ID: ${u.id_usuario}`;
    }
  }

  cargarMasFacturas(): void {
    const yaMostradas = this.facturasMostradas.length;
    const siguientes = this.facturas.slice(yaMostradas, yaMostradas + this.cantidadPorCarga);
    this.facturasMostradas.push(...siguientes);
  }

  @HostListener('window:scroll', [])
  onScroll(): void {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;

    if (scrollTop + windowHeight >= docHeight - 100) {
      this.cargarMasFacturas();
    }
  }

  getNombreUsuario(id: number): string {
    return this.usuariosMap[id] || `ID: ${id}`;
  }

  cambiarEstado(idFactura: number, nuevoEstado: string): void {
    const payload = { id_factura: idFactura, estado_fac: nuevoEstado };
    fetch(this.API_ESTADO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) throw new Error();
        const idxFact = this.facturas.findIndex(f => f.id_factura === idFactura);
        if (idxFact !== -1) this.facturas[idxFact].estado_fac = nuevoEstado;

        const idxMostradas = this.facturasMostradas.findIndex(f => f.id_factura === idFactura);
        if (idxMostradas !== -1) this.facturasMostradas[idxMostradas].estado_fac = nuevoEstado;

        if (this.isBrowser()) {
          localStorage.setItem('facturasCache', JSON.stringify(this.facturas));
        }
      })
      .catch(() => alert('Error al cambiar estado'));
  }

  filtrarPorTexto(): void {
    let cache: string = '[]';
    if (this.isBrowser()) {
      cache = localStorage.getItem('facturasCache') || '[]';
    }
    const texto = this.buscarTexto.toLowerCase();
    const facturasCacheadas = JSON.parse(cache) as Factura[];

    this.facturas = facturasCacheadas.filter(f =>
      (this.getNombreUsuario(f.id_usuario) || '').toLowerCase().includes(texto)
    );

    this.facturasMostradas = [];
    this.cargarMasFacturas();
  }

  buscarPorId(): void {
    if (!this.facturaIdSeleccionada) return;
    fetch(`${this.API_FACTURAS}/${this.facturaIdSeleccionada}`)
      .then(res => res.json())
      .then((data: Factura) => {
        this.facturas = [data];
        this.facturasMostradas = [data];
      });
    this.cerrarModal('#modalBuscarId');
  }

  buscarPorUsuario(): void {
    if (!this.usuarioSeleccionado) return;
    fetch(this.API_FACTURAS)
      .then(res => res.json())
      .then((data: Factura[]) => {
        this.facturas = data.filter(f => f.id_usuario == Number(this.usuarioSeleccionado));
        this.facturasMostradas = this.facturas.slice(0, this.cantidadPorCarga);
        this.cerrarModal('#modalBuscarUsuario');
      });
  }

  async verDetalle(factura: Factura): Promise<void> {
    this.detalleFactura = factura;
    const resDetalle = await fetch(`${this.API_DETALLE}/${factura.id_factura}`);
    const detalle = await resDetalle.json();

    const detallesValidos: DetalleFactura[] = Array.isArray(detalle) ? detalle : [detalle];
    this.detalleProductos = detallesValidos.map(d => {
      const producto = this.productosCache.find(p => p.id_producto == d.id_producto);
      return {
        nombre: producto?.pro_nombre || `Producto ${d.id_producto}`,
        cantidad: d.prf_cantidad,
        valor: parseFloat(d.prf_valor.toString()).toFixed(2)
      };
    });

    const modal = new (window as any).bootstrap.Modal(
      document.getElementById('modalDetalleFactura')
    );
    modal.show();
  }

  abrirModalPorId(): void {
    this.facturaIdSeleccionada = '';
    this.mostrarModal('#modalBuscarId');
  }

  abrirModalPorUsuario(): void {
    this.usuarioSeleccionado = '';
    this.mostrarModal('#modalBuscarUsuario');
  }

  mostrarModal(selector: string): void {
    const modalEl = document.querySelector(selector);
    if (modalEl) {
      const modal = new (window as any).bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  cerrarModal(selector: string): void {
    const modalEl = document.querySelector(selector);
    if (modalEl) {
      const modal = (window as any).bootstrap.Modal.getInstance(modalEl);
      modal?.hide();
    }
  }
}
