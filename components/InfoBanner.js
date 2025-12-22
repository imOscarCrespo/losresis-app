import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';

/**
 * Banner informativo que se puede cerrar y no vuelve a aparecer
 * @param {Object} props
 * @param {string} props.id - Identificador único del banner
 * @param {string} props.text - Texto a mostrar
 */
export const InfoBanner = ({ id, text }) => {
  const [isVisible, setIsVisible] = useState(false);
  const storageKey = `infoBanner_${id}_dismissed`;

  useEffect(() => {
    checkBannerStatus();
  }, []);

  const checkBannerStatus = async () => {
    try {
      const isDismissed = await AsyncStorage.getItem(storageKey);
      if (!isDismissed) {
        setIsVisible(true);
      }
    } catch (error) {
      console.error('Error checking banner status:', error);
      setIsVisible(true);
    }
  };

  const handleDismiss = async () => {
    try {
      await AsyncStorage.setItem(storageKey, 'true');
      setIsVisible(false);
    } catch (error) {
      console.error('Error dismissing banner:', error);
    }
  };

  // No renderizar si no hay texto o no es visible
  if (!isVisible || !text) return null;

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="information-circle" size={24} color={COLORS.PRIMARY} />
      </View>
      <Text style={styles.text}>{text}</Text>
      <TouchableOpacity
        onPress={handleDismiss}
        style={styles.closeButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close" size={20} color={COLORS.GRAY} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  iconContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  text: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.GRAY_DARK,
  },
  closeButton: {
    marginLeft: 8,
    padding: 4,
  },
});

export default InfoBanner;

