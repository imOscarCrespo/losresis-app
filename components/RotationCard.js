import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';

/**
 * Tarjeta para mostrar información de una rotación
 */
export const RotationCard = ({ rotation, isOwn, onDelete }) => {
  return (
    <View style={[styles.card, isOwn && styles.ownCard]}>
      {isOwn ? (
        // Versión compacta para rotaciones propias
        <>
          <View style={styles.info}>
            <Text style={styles.date}>
              📅 Desde:{' '}
              {new Date(rotation.start_date).toLocaleDateString('es-ES')}
            </Text>
            <Text style={styles.date}>
              📅 Hasta:{' '}
              {rotation.end_date
                ? new Date(rotation.end_date).toLocaleDateString('es-ES')
                : 'Actualidad'}
            </Text>
            <Text style={styles.coords}>
              📍 Lat: {rotation.latitude.toFixed(4)}, Lon:{' '}
              {rotation.longitude.toFixed(4)}
            </Text>
          </View>
          {onDelete && (
            <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
              <Ionicons name="trash-outline" size={20} color={COLORS.ERROR} />
            </TouchableOpacity>
          )}
        </>
      ) : (
        // Versión completa para rotaciones de otros usuarios
        <>
          <View style={styles.header}>
            <Text style={styles.name}>
              {rotation.user_name} {rotation.user_surname}
            </Text>
          </View>
          {rotation.user_email && (
            <Text style={styles.detail}>📧 {rotation.user_email}</Text>
          )}
          {rotation.user_phone && (
            <Text style={styles.detail}>📞 {rotation.user_phone}</Text>
          )}
          <Text style={styles.detail}>
            📍 Lat: {rotation.latitude.toFixed(4)}, Lon:{' '}
            {rotation.longitude.toFixed(4)}
          </Text>
          <Text style={styles.detail}>
            📅 Desde:{' '}
            {new Date(rotation.start_date).toLocaleDateString('es-ES')}
          </Text>
          <Text style={styles.detail}>
            📅 Hasta:{' '}
            {rotation.end_date
              ? new Date(rotation.end_date).toLocaleDateString('es-ES')
              : 'Actualidad'}
          </Text>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  ownCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SUCCESS + '20',
    borderWidth: 1,
    borderColor: COLORS.SUCCESS + '40',
  },
  header: {
    marginBottom: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.GRAY_DARK,
  },
  detail: {
    fontSize: 13,
    color: COLORS.GRAY,
    marginTop: 4,
  },
  info: {
    flex: 1,
  },
  date: {
    fontSize: 13,
    color: COLORS.GRAY_DARK,
    marginBottom: 4,
  },
  coords: {
    fontSize: 12,
    color: COLORS.GRAY,
    marginTop: 4,
  },
  deleteButton: {
    padding: 8,
  },
});

