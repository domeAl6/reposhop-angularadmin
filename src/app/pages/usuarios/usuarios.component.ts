import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
declare function alert(message?: any): void;
import { RouterModule } from '@angular/router';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, RouterModule, SidebarComponent],
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.css']
})
export class UsuariosComponent implements OnInit {
  apiURL = 'http://adminrest.runasp.net/api/gestion/usuarios';
  usuarios: any[] = [];
  usuariosFiltrados: any[] = [];
  usuarioActual: any = {};
  modoEdicion = false;
  filtroNombre = '';
  nombreSeleccionado = '';
  cargando: boolean = false;
  mensajeCamposFaltantes = false;
  mensajeErrores = false;
  maxFecha = new Date().toISOString().split('T')[0];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargarUsuariosDesdeCacheOApi();
  }

  isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  async cargarUsuariosDesdeCacheOApi(): Promise<void> {
    this.cargando = true;
    let cache = '';
    let timestamp = '';

    if (this.isBrowser()) {
      cache = localStorage.getItem('usuariosCache') || '';
      timestamp = localStorage.getItem('usuariosCacheTime') || '';
    }

    const expiracionMs = 5 * 60 * 1000;
    const cacheValido = cache && timestamp && (Date.now() - parseInt(timestamp)) < expiracionMs;

    if (cacheValido) {
      this.usuarios = JSON.parse(cache);
    } else {
      const data = await this.http.get<any[]>(this.apiURL).toPromise();
      this.usuarios = (data || []).map(u => ({
        ...u,
        id_usuario: u.id_usuario ?? u.id // Usa el campo correcto según tu backend
      }));
      if (this.isBrowser()) {
        localStorage.setItem('usuariosCache', JSON.stringify(this.usuarios));
        localStorage.setItem('usuariosCacheTime', Date.now().toString());
      }
    }

    this.usuariosFiltrados = [...this.usuarios];
    this.cargando = false;
  }

  refrescarUsuarios(): void {
    this.cargando = true;
    if (this.isBrowser()) {
      localStorage.removeItem('usuariosCache');
      localStorage.removeItem('usuariosCacheTime');
    }
    this.http.get<any[]>(this.apiURL).subscribe({
      next: (data) => {
        this.usuarios = data;
        this.usuariosFiltrados = [...data];
        if (this.isBrowser()) {
          localStorage.setItem('usuariosCache', JSON.stringify(this.usuarios));
          localStorage.setItem('usuariosCacheTime', Date.now().toString());
        }
        this.cargando = false;
      },
      error: (err) => {
        alert('Error al refrescar usuarios:\n' + err.message);
        this.cargando = false;
      }
    });
  }

  abrirModal(id: string): void {
    const modal = document.getElementById(id);
    if (modal) {
      const bsModal = new (window as any).bootstrap.Modal(modal);
      bsModal.show();
    }
  }

  cerrarModal(id: string, usuarioForm?: any): void {
    const modal = document.getElementById(id);
    if (modal) {
      const bsModal = (window as any).bootstrap.Modal.getInstance(modal);
      bsModal.hide();
    }
    this.mensajeCamposFaltantes = false;
    this.mensajeErrores = false;
    if (usuarioForm) usuarioForm.resetForm();
  }

  nuevoUsuario(): void {
    this.usuarioActual = {
      // ...otros campos...
      genero: '', // <-- así debe estar
      // ...otros campos...
    };
    this.modoEdicion = false;
    this.abrirModal('modalUsuario');
  }

  evitarNumeros(event: KeyboardEvent): void {
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

  // Cambia la función soloNumeros para aceptar longitud máxima
  soloNumeros(event: any, maxLength: number): void {
    event.target.value = event.target.value.replace(/[^0-9]/g, '').slice(0, maxLength);
    this.usuarioActual[event.target.name] = event.target.value;
  }

  // La función soloLetras ya está bien
  soloLetras(event: any): void {
    event.target.value = event.target.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g, '');
    this.usuarioActual[event.target.name] = event.target.value;
  }

  guardarUsuario(usuarioForm: any): void {
    this.mensajeCamposFaltantes = false;
    this.mensajeErrores = false;

    // Validación de fecha no futura
    const hoy = new Date(this.maxFecha);
    const fechaIngresada = new Date(this.usuarioActual.fecha_nacimiento);
    if (fechaIngresada > hoy) {
      this.mensajeCamposFaltantes = true;
      usuarioForm.controls['fecha_nacimiento'].setErrors({ futureDate: true });
      return;
    }

    if (usuarioForm.invalid) {
      this.mensajeCamposFaltantes = true;
      Object.values(usuarioForm.controls).forEach((control: any) => {
        control.markAsTouched();
      });
      return;
    }

    if (
      usuarioForm.controls['nombre'].invalid || 
      usuarioForm.controls['apellido'].invalid || 
      usuarioForm.controls['telefono'].invalid || 
      usuarioForm.controls['cedula'].invalid ||
      usuarioForm.controls['email'].invalid || 
      usuarioForm.controls['username'].invalid || 
      usuarioForm.controls['password'].invalid || 
      usuarioForm.controls['direccion'].invalid || 
      usuarioForm.controls['genero'].invalid || 
      usuarioForm.controls['fecha_nacimiento'].invalid
    ) {
      this.mensajeErrores = true;
      return;
    }

    const usuario = this.usuarioActual;
    const metodo = this.modoEdicion ? 'put' : 'post';
    const url = this.modoEdicion ? `${this.apiURL}/${usuario.id_usuario}` : this.apiURL;

    (this.http[metodo] as (url: string, body: any) => any)(url, usuario).subscribe({
      next: (resp: any) => {
        if (this.modoEdicion) {
          const idx = this.usuarios.findIndex(u => u.id_usuario === this.usuarioActual.id_usuario);
          if (idx !== -1) {
            this.usuarios[idx] = { ...this.usuarioActual };
          }
        } else {
          this.usuarios.push({ ...resp });
        }
        this.usuariosFiltrados = [...this.usuarios];
        this.mostrarTodos(); // <-- Limpia los filtros y muestra todos
        if (this.isBrowser()) {
          localStorage.setItem('usuariosCache', JSON.stringify(this.usuarios));
          localStorage.setItem('usuariosCacheTime', Date.now().toString());
        }
        this.cerrarModal('modalUsuario');
      },
      error: (err: any) => alert("Error al guardar usuario:\n" + err.error)
    });
  }

  editarUsuario(usuario: any): void {
    this.usuarioActual = { ...usuario };
    // Formatea la fecha para el input type="date"
    if (this.usuarioActual.fecha_nacimiento) {
      this.usuarioActual.fecha_nacimiento = this.usuarioActual.fecha_nacimiento.split('T')[0];
    }
    this.modoEdicion = true;
    this.abrirModal('modalUsuario');
  }

  eliminarUsuario(id: number): void {
    if (!id) {
      alert('No se puede eliminar: ID de usuario no definido.');
      return;
    }
    if (!confirm("¿Deseas eliminar este usuario?")) return;
    this.http.delete(`${this.apiURL}/${id}`).subscribe({
      next: () => {
        this.usuarios = this.usuarios.filter(u => u.id_usuario !== id);
        this.usuariosFiltrados = [...this.usuarios];
        this.mostrarTodos(); 
        if (this.isBrowser()) {
          localStorage.setItem('usuariosCache', JSON.stringify(this.usuarios));
          localStorage.setItem('usuariosCacheTime', Date.now().toString());
        }
      },
      error: (err: any) => alert("Error al eliminar usuario:\n" + err.message)
    });
  }

  filtrarPorNombre(event: Event): void {
    const texto = (event.target as HTMLInputElement).value.toLowerCase();
    this.usuariosFiltrados = this.usuarios.filter(u =>
      u.nombre.toLowerCase().includes(texto)
    );
  }

  buscarPorNombre(): void {
    if (!this.nombreSeleccionado) return;
    this.usuariosFiltrados = this.usuarios.filter(u =>
      `${u.nombre} ${u.apellido}`.toLowerCase() === this.nombreSeleccionado.toLowerCase()
    );
    this.cerrarModal('modalBuscarUsuario');
  }

  mostrarTodos(): void {
    this.filtroNombre = '';
    this.nombreSeleccionado = '';
    this.usuariosFiltrados = [...this.usuarios];
    
  }
}
