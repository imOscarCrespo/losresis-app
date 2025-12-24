import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { formatShortDate } from '../utils/dateUtils';

/**
 * Tarjeta para mostrar una reseña de rotación externa en el listado de la comunidad
 */
export const RotationReviewListCard = ({ review, onPress }) => {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress && onPress(review)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Ionicons name="business" size={20} color={COLORS.PRIMARY} />
        <Text style={styles.hospitalName}>
          {review.external_hospital_name}
        </Text>
      </View>
      <Text style={styles.location}>
        {review.city}, {review.country}
      </Text>
      {review.external_rotation && (
        <Text style={styles.dates}>
          {formatShortDate(review.external_rotation.start_date)}
          {review.external_rotation.end_date &&
            ` - ${formatShortDate(review.external_rotation.end_date)}`}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  hospitalName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.GRAY_DARK,
    flex: 1,
  },
  location: {
    fontSize: 14,
    color: COLORS.GRAY,
    marginBottom: 4,
  },
  dates: {
    fontSize: 13,
    color: COLORS.GRAY,
  },
});

