const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api'
).replace(/\/+$/, '');

export interface Finca {
  id: number;
  nombre: string;
  lat: number;
  lng: number;
}

export interface Ruta {
  id: number;
  nombre: string;
  finca: string;
  fincaId: number;
  puntos: number;
  guardada: string;
}

export interface RegistroCalidad {
  id: number;
  finca: string;
  fincaId: number;
  fecha: string;
  humedad: number;
  fermentacion: number;
  temperatura: number;
  observaciones: string;
  estado: 'bien_fermentado' | 'parcial' | 'sin_fermentar';
}

export interface AuthResult {
  token: string;
  usuario: {
    id: number;
    nombre: string;
    email: string;
  };
}

export class ApiConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiConnectionError';
  }
}

export class ApiResponseError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiResponseError';
  }
}

interface ApiErrorBody {
  error?: string;
}

async function request<T>(
  path: string,
  token?: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiConnectionError(
      `No se pudo conectar con la API (${API_URL}). Verifica que el backend esté activo y que EXPO_PUBLIC_API_URL apunte a tu equipo.`,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new ApiResponseError(
      body.error ?? `Error de API (${response.status})`,
      response.status,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  health: () => request<{ status: 'ok' }>('/health'),

  register: (data: {
    nombre: string;
    email: string;
    telefono: string;
    municipio: string;
    password: string;
  }) =>
    request<{ usuario: AuthResult['usuario'] }>('/auth/register', undefined, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (email: string, password: string) =>
    request<AuthResult>('/auth/login', undefined, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  fincas: (token: string) => request<Finca[]>('/fincas', token),
  crearFinca: (
    token: string,
    data: Pick<Finca, 'nombre' | 'lat' | 'lng'>,
  ) =>
    request<Finca>('/fincas', token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  actualizarFinca: (
    token: string,
    id: number,
    data: Partial<Pick<Finca, 'nombre' | 'lat' | 'lng'>>,
  ) =>
    request<Finca>(`/fincas/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  eliminarFinca: (token: string, id: number) =>
    request<void>(`/fincas/${id}`, token, { method: 'DELETE' }),

  rutas: (token: string) => request<Ruta[]>('/rutas', token),
  crearRuta: (
    token: string,
    data: { nombre: string; fincaId: number; puntos: number },
  ) =>
    request<Ruta>('/rutas', token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  actualizarRuta: (
    token: string,
    id: number,
    data: Partial<{ nombre: string; fincaId: number; puntos: number }>,
  ) =>
    request<Ruta>(`/rutas/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  eliminarRuta: (token: string, id: number) =>
    request<void>(`/rutas/${id}`, token, { method: 'DELETE' }),

  calidad: (token: string) =>
    request<RegistroCalidad[]>('/calidad', token),
  crearRegistroCalidad: (
    token: string,
    data: Omit<RegistroCalidad, 'id' | 'finca'>,
  ) =>
    request<RegistroCalidad>('/calidad', token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  actualizarRegistroCalidad: (
    token: string,
    id: number,
    data: Partial<Omit<RegistroCalidad, 'id' | 'finca'>>,
  ) =>
    request<RegistroCalidad>(`/calidad/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  eliminarRegistroCalidad: (token: string, id: number) =>
    request<void>(`/calidad/${id}`, token, { method: 'DELETE' }),
};
