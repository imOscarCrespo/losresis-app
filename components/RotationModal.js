import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS } from '../constants/colors';

/**
 * Modal para crear o editar una rotación externa
 */
export const RotationModal = ({
  visible,
  onClose,
  onSubmit,
  existingRotation,
  userPhone,
  loading,
}) => {
  const [formData, setFormData] = useState({
    latitude: 40.4168,
    longitude: -3.7038,
    start_date: new Date(),
    end_date: null,
    phone: userPhone || '',
  });
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [hasEndDate, setHasEndDate] = useState(false);

  // Cargar datos existentes cuando se abre el modal
  useEffect(() => {
    if (visible) {
      if (existingRotation) {
        setFormData({
          latitude: existingRotation.latitude,
          longitude: existingRotation.longitude,
          start_date: new Date(existingRotation.start_date),
          end_date: existingRotation.end_date ? new Date(existingRotation.end_date) : null,
          phone: userPhone || '',
        });
        setHasEndDate(!!existingRotation.end_date);
      } else {
        setFormData({
          latitude: 40.4168,
          longitude: -3.7038,
          start_date: new Date(),
          end_date: null,
          phone: userPhone || '',
        });
        setHasEndDate(false);
      }
    }
  }, [visible, existingRotation, userPhone]);

  const handleSubmit = () => {
    onSubmit(formData, hasEndDate);
  };

  const handleStartDateChange = (event, selectedDate) => {
    setShowStartDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setFormData({ ...formData, start_date: selectedDate });
    }
  };

  const handleEndDateChange = (event, selectedDate) => {
    setShowEndDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setFormData({ ...formData, end_date: selectedDate });
    }
  };

  const toggleHasEndDate = () => {
    const newHasEndDate = !hasEndDate;
    setHasEndDate(newHasEndDate);
    if (!newHasEndDate) {
      setFormData({ ...formData, end_date: null });
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {existingRotation ? 'Editar Rotación' : 'Nueva Rotación'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={COLORS.GRAY_DARK} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.form}
            contentContainerStyle={styles.formContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Latitude */}
            <View style={styles.field}>
              <Text style={styles.label}>Latitud *</Text>
              <TextInput
                style={styles.input}
                value={String(formData.latitude)}
                onChangeText={(text) =>
                  setFormData({ ...formData, latitude: text })
                }
                keyboardType="numeric"
                placeholder="40.4168"
              />
            </View>

            {/* Longitude */}
            <View style={styles.field}>
              <Text style={styles.label}>Longitud *</Text>
              <TextInput
                style={styles.input}
                value={String(formData.longitude)}
                onChangeText={(text) =>
                  setFormData({ ...formData, longitude: text })
                }
                keyboardType="numeric"
                placeholder="-3.7038"
              />
            </View>

            {/* Start Date */}
            <View style={styles.field}>
              <Text style={styles.label}>Fecha de inicio *</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Text style={styles.dateButtonText}>
                  {formData.start_date.toLocaleDateString('es-ES')}
                </Text>
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={COLORS.GRAY_DARK}
                />
              </TouchableOpacity>
              {showStartDatePicker && (
                <DateTimePicker
                  value={formData.start_date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleStartDateChange}
                />
              )}
            </View>

            {/* End Date Checkbox */}
            <TouchableOpacity style={styles.checkboxRow} onPress={toggleHasEndDate}>
              <View style={[styles.checkbox, hasEndDate && styles.checkboxChecked]}>
                {hasEndDate && (
                  <Ionicons name="checkmark" size={16} color={COLORS.WHITE} />
                )}
              </View>
              <Text style={styles.checkboxLabel}>¿Tiene fecha de fin?</Text>
            </TouchableOpacity>

            {/* End Date */}
            {hasEndDate && (
              <View style={styles.field}>
                <Text style={styles.label}>Fecha de fin</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowEndDatePicker(true)}
                >
                  <Text style={styles.dateButtonText}>
                    {formData.end_date
                      ? formData.end_date.toLocaleDateString('es-ES')
                      : 'Seleccionar fecha'}
                  </Text>
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={COLORS.GRAY_DARK}
                  />
                </TouchableOpacity>
                {showEndDatePicker && (
                  <DateTimePicker
                    value={formData.end_date || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleEndDateChange}
                    minimumDate={formData.start_date}
                  />
                )}
              </View>
            )}

            {/* Phone */}
            <View style={styles.field}>
              <Text style={styles.label}>Teléfono (opcional)</Text>
              <TextInput
                style={styles.input}
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                keyboardType="phone-pad"
                placeholder="Teléfono de contacto"
              />
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.WHITE} />
              ) : (
                <Text style={styles.submitButtonText}>
                  {existingRotation ? 'Actualizar' : 'Crear'}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    flex: 1,
  },
  content: {
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '75%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.GRAY_DARK,
  },
  form: {
    flex: 1,
  },
  formContent: {
    padding: 20,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.GRAY_DARK,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.WHITE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: COLORS.GRAY_DARK,
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.WHITE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    padding: 14,
  },
  dateButtonText: {
    fontSize: 16,
    color: COLORS.GRAY_DARK,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.BORDER,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  checkboxLabel: {
    fontSize: 16,
    color: COLORS.GRAY_DARK,
  },
  actions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    gap: 12,
  },
  submitButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  cancelButton: {
    backgroundColor: COLORS.BACKGROUND,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.GRAY_DARK,
  },
});

