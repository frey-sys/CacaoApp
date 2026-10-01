import type { Finca } from '@/services/api';

const CITY_CENTER = { latitude: 7.6667, longitude: -76.6833 };

export function createUrbanMapHtml(fincas: Finca[]): string {
  const markerData = JSON.stringify(
    fincas.map(({ id, nombre, lat, lng }) => ({ id, nombre, lat, lng })),
  ).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
    html, body, #map { width: 100%; height: 100%; margin: 0; background: #e9efe8; }
    .farm-pin { display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: 3px solid white; border-radius: 50% 50% 50% 0; background: #2d7a1f; box-shadow: 0 2px 7px #0005; color: white; font: 700 17px sans-serif; transform: rotate(-45deg); }
    .farm-pin span { transform: rotate(45deg); }
    .load-error { position: absolute; z-index: 1000; inset: 0; display: none; align-items: center; justify-content: center; padding: 24px; color: #344536; background: #e9efe8; font: 15px sans-serif; text-align: center; }
    .leaflet-popup-content-wrapper { border-radius: 10px; }
  </style>
</head>
<body>
  <div id="map" aria-label="Mapa urbano de Chigorodó"></div>
  <div id="load-error" class="load-error" role="alert">No se pudo cargar el mapa. Verifica tu conexión a internet e inténtalo de nuevo.</div>
  <script>
    const showError = () => { document.getElementById('load-error').style.display = 'flex'; };
    const initializeMap = () => {
      const map = L.map('map', { zoomControl: true }).setView(
        [${CITY_CENTER.latitude}, ${CITY_CENTER.longitude}], 15
      );
      const tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      });
      const tileLoadTimeout = setTimeout(showError, 15000);
      tileLayer.on('load', () => {
        clearTimeout(tileLoadTimeout);
        document.getElementById('load-error').style.display = 'none';
      });
      tileLayer.addTo(map);

      const farms = ${markerData};
      farms.forEach((farm) => {
        const icon = L.divIcon({
          className: '',
          html: '<div class="farm-pin"><span>F</span></div>',
          iconSize: [34, 40],
          iconAnchor: [17, 38],
          popupAnchor: [0, -36]
        });
        L.marker([farm.lat, farm.lng], { icon })
          .addTo(map)
          .bindPopup('<strong>' + escapeHtml(farm.nombre) + '</strong><br>Finca registrada');
      });

      map.whenReady(() => {
        if (farms.length > 0) {
          const visibleFarms = farms.filter((farm) => {
            const distance = map.distance(
              [${CITY_CENTER.latitude}, ${CITY_CENTER.longitude}],
              [farm.lat, farm.lng]
            );
            return distance < 10000;
          });
          if (visibleFarms.length > 0) {
            const bounds = L.latLngBounds([
              [${CITY_CENTER.latitude}, ${CITY_CENTER.longitude}],
              ...visibleFarms.map((farm) => [farm.lat, farm.lng])
            ]);
            map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
          }
        }
      });
    };
    const escapeHtml = (value) => {
      const element = document.createElement('span');
      element.textContent = value;
      return element.innerHTML;
    };
    const leafletScript = document.createElement('script');
    leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    leafletScript.onload = initializeMap;
    leafletScript.onerror = showError;
    document.head.appendChild(leafletScript);
  </script>
</body>
</html>`;
}
