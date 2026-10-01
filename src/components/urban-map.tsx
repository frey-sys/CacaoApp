import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

import type { Finca } from '@/services/api';
import { createUrbanMapHtml } from './urban-map-html';

export function UrbanMap({ fincas }: { fincas: Finca[] }) {
  return (
    <WebView
      originWhitelist={['https://www.openstreetmap.org']}
      source={{
        html: createUrbanMapHtml(fincas),
        baseUrl: 'https://www.openstreetmap.org',
      }}
      javaScriptEnabled
      style={styles.map}
      accessibilityLabel="Mapa urbano de Chigorodó"
    />
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    backgroundColor: '#E9EFE8',
  },
});
