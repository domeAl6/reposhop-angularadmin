import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';

declare function alert(message?: any): void;

@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, RouterModule, SidebarComponent],
  templateUrl: './productos.component.html',
  styleUrls: ['./productos.component.css']
})
export class ProductosComponent implements OnInit {
  apiURL = 'http://adminrest.runasp.net/api/gestion/productos';
  productos: any[] = [];
  productosFiltrados: any[] = [];
  productoSeleccionado: any = {};
  modoEdicion = false;
  buscarNombre = '';
  productoIdBuscar = '';
  cargando = false;
  mensajeCamposFaltantes = false;

  colores = [
    'bg-pastel-blue', 'bg-pastel-yellow', 'bg-pastel-pink',
    'bg-pastel-green', 'bg-pastel-orange', 'bg-pastel-purple'
  ];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargarProductos();
  }

  cargarProductos(): void {
    this.cargando = true;
    this.http.get<any[]>(this.apiURL).subscribe({
      next: (data) => {
        this.productos = data;
        this.productosFiltrados = [...data];
        this.cargando = false;
      },
      error: (err) => {
        alert('Error al cargar productos: ' + err.message);
        this.cargando = false;
      }
    });
  }

  refrescarDesdeApi(): void {
    this.cargarProductos();
  }

  abrirNuevoProducto(): void {
    this.productoSeleccionado = {
      categoriaid: '', 
      pro_lleva_iva: ''
    }
    this.modoEdicion = false;
    this.abrirModal('modalProducto');
  }

  editarProducto(p: any): void {
    this.productoSeleccionado = { ...p };
    let iva = this.productoSeleccionado.pro_lleva_iva;
    if (
      iva === true ||
      iva === 'true' ||
      iva === 'TRUE' ||
      iva === 'si' ||
      iva === 'SI' ||
      iva === 'SÍ' ||
      iva === 'yes' ||
      iva === 'YES' ||
      iva === 1
    ) {
      this.productoSeleccionado.pro_lleva_iva = 'SI';
    } else if (
      iva === false ||
      iva === 'false' ||
      iva === 'FALSE' ||
      iva === 'no' ||
      iva === 'NO' ||
      iva === 0
    ) {
      this.productoSeleccionado.pro_lleva_iva = 'NO';
    } else {
      this.productoSeleccionado.pro_lleva_iva = '';
    }
    this.modoEdicion = true;
    this.abrirModal('modalProducto');
  }

  guardarProducto(productoForm: any): void {
    if (productoForm.invalid) {
      this.mensajeCamposFaltantes = true;
      Object.values(productoForm.controls).forEach((control: any) => {
        control.markAsTouched();
      });
      return;
    }
    this.mensajeCamposFaltantes = false;
    // --- CAMBIO SOLO EN ESTA LÍNEA ---
    const p = { ...this.productoSeleccionado }; // Hacemos una copia para enviar

    // Convierte coma a punto si el usuario la escribió
    if (typeof p.pro_precio_compra === 'string') {
      p.pro_precio_compra = p.pro_precio_compra.replace(',', '.');
    }
    if (typeof p.pro_precio_venta === 'string') {
      p.pro_precio_venta = p.pro_precio_venta.replace(',', '.');
    }

    // Convierte a número decimal
    p.pro_precio_compra = Number(p.pro_precio_compra);
    p.pro_precio_venta = Number(p.pro_precio_venta);

    // Stock solo entero positivo
    p.pro_saldo_final = Math.max(0, parseInt(p.pro_saldo_final, 10) || 0);

    // Validar que precios y stock no sean negativos
    if (
      p.pro_precio_compra < 0 ||
      p.pro_precio_venta < 0 ||
      Number(p.pro_saldo_final) < 0
    ) {
      alert('Los precios y el stock no pueden ser negativos.');
      return;
    }

    // Normaliza pro_lleva_iva SOLO EN LA COPIA
    if (p.pro_lleva_iva === 'SI' || p.pro_lleva_iva === true) {
      p.pro_lleva_iva = true;
    } else if (p.pro_lleva_iva === 'NO' || p.pro_lleva_iva === false) {
      p.pro_lleva_iva = false;
    } else {
      p.pro_lleva_iva = null;
    }

    this.cargando = true;

    if (this.modoEdicion && p.id_producto) {
      // EDITAR (PUT)
      this.http.put(`${this.apiURL}/${p.id_producto}`, p).subscribe({
        next: () => {
          this.cerrarModal('modalProducto');
          this.cargarProductos();
          this.cargando = false;
        },
        error: () => {
          alert('Error al actualizar el producto');
          this.cargando = false;
        }
      });
    } else {
      // CREAR (POST)
      this.http.post(this.apiURL, p).subscribe({
        next: () => {
          this.cerrarModal('modalProducto');
          this.cargarProductos();
          this.cargando = false;
        },
        error: () => {
          alert('Error al guardar el producto');
          this.cargando = false;
        }
      });
    }
  }

  actualizarProductoIndividual(id: number): void {
    this.cargando = true;
    this.http.get<any>(`${this.apiURL}/${id}`).subscribe({
      next: (productoActualizado) => {
        const index = this.productos.findIndex(p => p.id_producto === id);
        if (index !== -1) {
          this.productos[index] = productoActualizado;
        }
        this.productosFiltrados = [...this.productos];
        this.cargando = false;
      },
      error: (err) => {
        alert('Error al actualizar producto: ' + err.message);
        this.cargando = false;
      }
    });
  }

  eliminarProducto(id: number): void {
    if (!confirm('¿Deseas eliminar este producto?')) return;
    this.http.delete(`${this.apiURL}/${id}`).subscribe({
      next: () => this.cargarProductos(),
      error: (err) => alert('Error al eliminar producto: ' + err.message)
    });
  }

  buscarPorNombreInput(): void {
    const texto = this.buscarNombre.toLowerCase();
    this.productosFiltrados = this.productos.filter(p =>
      p.pro_nombre.toLowerCase().includes(texto)
    );
  }

  buscarPorId(): void {
    const id = Number(this.productoIdBuscar);
    const encontrado = this.productos.find(p => p.id_producto === id);
    this.productosFiltrados = encontrado ? [encontrado] : [];
    this.cerrarModal('modalBuscarProducto');
  }

  mostrarTodos(): void {
    this.buscarNombre = '';
    this.productoIdBuscar = '';
    this.productosFiltrados = [...this.productos];
  }

  mostrarSelector(): void {
    this.abrirModal('modalBuscarProducto');
  }

  abrirModal(id: string): void {
    const modal = document.getElementById(id);
    if (modal) {
      const bsModal = new (window as any).bootstrap.Modal(modal);
      bsModal.show();
    }
  }

  cerrarModal(id: string, productoForm?: any): void {
    const modal = document.getElementById(id);
    if (modal) {
      const bsModal = (window as any).bootstrap.Modal.getInstance(modal);
      bsModal.hide();
    }
    this.mensajeCamposFaltantes = false;
    // Solo limpia el formulario si NO estás editando
    if (productoForm && !this.modoEdicion) productoForm.resetForm();
  }

  evitarMenos(event: KeyboardEvent): void {
    if (event.key === '-' || event.key === 'Subtract') {
      event.preventDefault();
    }
  }

  validarNumero(campo: string): void {
    if (this.productoSeleccionado[campo] < 0) {
      this.productoSeleccionado[campo] = 0;
    }
  }

  soloNumerosDecimales(event: KeyboardEvent): void {
    // Permite: números, punto, backspace, delete, tab, flechas, home, end
    if (
      event.ctrlKey || event.metaKey || // Permite copiar/pegar
      ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
    ) {
      return; // No bloquea nada de esto
    }
    // Permite solo un punto decimal
    if (event.key === '.') {
      const input = event.target as HTMLInputElement;
      if (input.value.includes('.')) {
        event.preventDefault();
      }
      return;
    }
    // Solo números
    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
    }
    // No permitir el símbolo menos ni letras
    if (event.key === '-' || /[a-zA-Z]/.test(event.key)) {
      event.preventDefault();
    }
  }

  soloNumerosEnteros(event: KeyboardEvent): void {
    // Permite: números, backspace, tab, delete, flechas
    const allowed = [
      '0','1','2','3','4','5','6','7','8','9','Backspace','Tab','Delete','ArrowLeft','ArrowRight','Home','End'
    ];
    if (!allowed.includes(event.key)) {
      event.preventDefault();
    }
    // No permitir el símbolo menos, punto ni coma
    if (event.key === '-' || event.key === '.' || event.key === ',') {
      event.preventDefault();
    }
  }

  validarDecimal(campo: string): void {
    let valor = this.productoSeleccionado[campo];
    // Si está vacío, no lo cambies (permite borrar)
    if (valor === '' || valor === null) {
      return;
    }
    // Si es negativo o NaN, poner 0
    if (isNaN(valor) || Number(valor) < 0) {
      this.productoSeleccionado[campo] = 0;
    } else {
      // Solo dos decimales
      this.productoSeleccionado[campo] = parseFloat(Number(valor).toFixed(2));
    }
  }

  validarEntero(campo: string): void {
    let valor = this.productoSeleccionado[campo];
    // Si es negativo, decimal, vacío o NaN, poner 0
    if (valor === '' || valor === null || isNaN(valor) || Number(valor) < 0) {
      this.productoSeleccionado[campo] = 0;
    } else {
      this.productoSeleccionado[campo] = Math.floor(Number(valor));
    }
  }

  evitarNumeros(event: KeyboardEvent): void {
    // Permite letras, espacio, backspace, tab, delete, flechas, home, end
    const allowed = [
      'Backspace','Tab','Delete','ArrowLeft','ArrowRight','Home','End',' '
    ];
    if (
      (event.key >= '0' && event.key <= '9') ||
      (!allowed.includes(event.key) && !/^[a-zA-ZáéíóúÁÉÍÓÚñÑ]$/.test(event.key))
    ) {
      event.preventDefault();
    }
  }

  formatearDecimal(campo: string): void {
    let valor = this.productoSeleccionado[campo];
    if (valor === '' || valor === null) {
      return; // Permite borrar
    }
    if (typeof valor === 'string') {
      // Reemplaza coma por punto
      valor = valor.replace(/,/g, '.');
      // Elimina cualquier caracter que no sea número o punto
      valor = valor.replace(/[^0-9.]/g, '');
      // Solo un punto permitido
      const partes = valor.split('.');
      if (partes.length > 2) {
        valor = partes[0] + '.' + partes.slice(1).join('');
      }
      // Evita valores negativos
      if (valor.startsWith('-')) valor = valor.replace('-', '');
      this.productoSeleccionado[campo] = valor;
    }
    // Si es número, asegúrate que no sea negativo
    if (typeof valor === 'number' && valor < 0) {
      this.productoSeleccionado[campo] = 0;
    }
  }

  validarDecimalKey(event: KeyboardEvent): void {
    // Permite: números, punto, coma, backspace, tab, delete, flechas
    const allowed = [
      '0','1','2','3','4','5','6','7','8','9','.','Backspace','Tab','Delete','ArrowLeft','ArrowRight','Home','End',','
    ];
    if (!allowed.includes(event.key)) {
      event.preventDefault();
    }
    // No permitir el símbolo menos
    if (event.key === '-') {
      event.preventDefault();
    }
  }

  // Convierte el valor a número decimal antes de guardar (en guardarProducto)
  private decimalAFloat(valor: string | number): number {
    if (typeof valor === 'string') {
      return parseFloat(valor.replace(',', '.'));
    }
    return Number(valor);
  }
}
