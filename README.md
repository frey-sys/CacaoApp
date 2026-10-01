# CacaoApp

Aplicación Expo para gestionar fincas cacaoteras, rutas y registros de calidad mediante una API Express con almacenamiento SQLite en el servidor. Se requiere conexión al backend para iniciar sesión, consultar y guardar datos. Si la API no está disponible, la aplicación muestra el error y no almacena cambios localmente.

## Configuración

1. Instala las dependencias:

   ```bash
   npm install
   ```

2. Copia `.env.example` a `.env` y cambia `JWT_SECRET` por una clave aleatoria de al menos 32 caracteres.

3. Si ejecutas la aplicación en un teléfono físico, configura `EXPO_PUBLIC_API_URL` en `.env` con la IP local de tu equipo, por ejemplo `http://192.168.1.20:3000/api`. El teléfono y el equipo deben estar en la misma red.

La sesión puede permanecer guardada de forma segura en el dispositivo, pero se valida contra el servidor al abrir la aplicación. Los registros y cambios se consultan y escriben únicamente en la API.
## Ejecución

Inicia la API y la aplicación en terminales separadas:

```bash
npm run server
npm start
```

La API crea automáticamente `backend/data/cacaoapp.sqlite` al iniciarse. Comprueba el estado en `http://localhost:3000/api/health`.

## API

- `POST /api/auth/register` y `POST /api/auth/login`
- `/api/fincas`: GET, POST, GET por ID, PATCH y DELETE
- `/api/rutas`: GET, POST, GET por ID, PATCH y DELETE
- `/api/calidad`: GET, POST, GET por ID, PATCH y DELETE

Los endpoints de fincas, rutas y calidad requieren `Authorization: Bearer <token>`. Cada usuario solo puede consultar y modificar sus propios registros. Las rutas y los registros de calidad se relacionan con fincas mediante `fincaId`.

## Validación

```bash
npm run lint
npx tsc --noEmit
```
