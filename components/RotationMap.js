import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';

// Intentar importar MapView
let MapView = null;
let Marker = null;
let Callout = null;
let PROVIDER_DEFAULT = null;
let MAP_AVAILABLE = false;

try {
  const MapModule = require('react-native-maps');
  MapView = MapModule.default;
  Marker = MapModule.Marker;
  Callout = MapModule.Callout;
  PROVIDER_DEFAULT = MapModule.PROVIDER_DEFAULT;
  MAP_AVAILABLE = true;
} catch (error) {
  MAP_AVAILABLE = false;
}

/**
 * Componente de mapa para rotaciones externas
 */
export const RotationMap = ({ rotations, userId, loading }) => {
  if (!MAP_AVAILABLE) {
    return (
      <View style={styles.unavailable}>
        <Ionicons name="map-outline" size={48} color={COLORS.GRAY} />
        <Text style={styles.unavailableTitle}>Mapa no disponible</Text>
        <Text style={styles.unavailableText}>
          El mapa requiere un desarrollo build de Expo.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 40.4168,
          longitude: -3.7038,
          latitudeDelta: 10,
          longitudeDelta: 10,
        }}
        provider={PROVIDER_DEFAULT}
      >
        {rotations.map((rotation) => {
          const isOwnRotation = rotation.user_id === userId;
          return (
            <Marker
              key={rotation.id}
              coordinate={{
                latitude: rotation.latitude,
                longitude: rotation.longitude,
              }}
              pinColor={isOwnRotation ? COLORS.SUCCESS : COLORS.PRIMARY}
            >
              <Callout>
                <View style={styles.callout}>
                  <Text style={styles.calloutName}>
                    {rotation.user_name} {rotation.user_surname}
                    {isOwnRotation && ' (Tú)'}
                  </Text>
                  {rotation.user_email && (
                    <Text style={styles.calloutEmail}>
                      {rotation.user_email}
                    </Text>
                  )}
                  {rotation.user_phone && (
                    <Text style={styles.calloutPhone}>
                      {rotation.user_phone}
                    </Text>
                  )}
                  <Text style={styles.calloutDates}>
                    Desde:{' '}
                    {new Date(rotation.start_date).toLocaleDateString('es-ES')}
                  </Text>
                  <Text style={styles.calloutDates}>
                    Hasta:{' '}
                    {rotation.end_date
                      ? new Date(rotation.end_date).toLocaleDateString('es-ES')
                      : 'Actualidad'}
                  </Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 400,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    marginBottom: 16,
  },
  unavailable: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  unavailableTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.GRAY_DARK,
    marginTop: 12,
    marginBottom: 4,
  },
  unavailableText: {
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: 'center',
  },
  callout: {
    padding: 8,
    minWidth: 200,
  },
  calloutName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.GRAY_DARK,
    marginBottom: 4,
  },
  calloutEmail: {
    fontSize: 12,
    color: COLORS.GRAY,
    marginBottom: 2,
  },
  calloutPhone: {
    fontSize: 12,
    color: COLORS.GRAY,
    marginBottom: 2,
  },
  calloutDates: {
    fontSize: 12,
    color: COLORS.GRAY,
    marginTop: 4,
  },
});

