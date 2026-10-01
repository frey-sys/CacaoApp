import { createElement } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Finca } from '@/services/api';
import { createUrbanMapHtml } from './urban-map-html';

export function UrbanMap({ fincas }: { fincas: Finca[] }) {
  return (
    <View style={styles.container}>
      {createElement('iframe', {
        title: 'Mapa urbano de Chigorodó',
        srcDoc: createUrbanMapHtml(fincas),
        sandbox: 'allow-scripts allow-popups',
        style: {
          width: '100%',
          height: '100%',
          border: 0,
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
