import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';

/**
 * Modal para seleccionar una fecha
 * @param {Object} props
 * @param {boolean} props.visible - Si el modal está visible
 * @param {Date} props.selectedDate - Fecha seleccionada
 * @param {Function} props.onSelect - Callback al seleccionar una fecha
 * @param {Function} props.onClose - Callback al cerrar el modal
 */
export const DatePickerModal = ({ visible, selectedDate, onSelect, onClose }) => {
  const currentDate = selectedDate || new Date();
  const [displayMonth, setDisplayMonth] = useState(currentDate.getMonth());
  const [displayYear, setDisplayYear] = useState(currentDate.getFullYear());

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  // Calcular días del mes
  const calendarDays = useMemo(() => {
    const firstDay = new Date(displayYear, displayMonth, 1);
    const lastDay = new Date(displayYear, displayMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Días vacíos al inicio
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Días del mes
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  }, [displayMonth, displayYear]);

  const handleDayPress = (day) => {
    if (!day) return;
    const newDate = new Date(displayYear, displayMonth, day);
    onSelect(newDate);
    onClose();
  };

  const handlePrevMonth = () => {
    if (displayMonth === 0) {
      setDisplayMonth(11);
      setDisplayYear(displayYear - 1);
    } else {
      setDisplayMonth(displayMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (displayMonth === 11) {
      setDisplayMonth(0);
      setDisplayYear(displayYear + 1);
    } else {
      setDisplayMonth(displayMonth + 1);
    }
  };

  const isSelectedDay = (day) => {
    if (!day || !selectedDate) return false;
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === displayMonth &&
      selectedDate.getFullYear() === displayYear
    );
  };

  const isToday = (day) => {
    if (!day) return false;
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === displayMonth &&
      today.getFullYear() === displayYear
    );
  };

  const isWeekend = (day) => {
    if (!day) return false;
    const date = new Date(displayYear, displayMonth, day);
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.navButton}>
              <Ionicons name="chevron-back" size={24} color={COLORS.PRIMARY} />
            </TouchableOpacity>

            <Text style={styles.headerText}>
              {monthNames[displayMonth]} {displayYear}
            </Text>

            <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
              <Ionicons name="chevron-forward" size={24} color={COLORS.PRIMARY} />
            </TouchableOpacity>
          </View>

          {/* Días de la semana */}
          <View style={styles.dayNamesRow}>
            {dayNames.map((dayName, index) => (
              <View key={index} style={styles.dayNameCell}>
                <Text style={styles.dayNameText}>{dayName}</Text>
              </View>
            ))}
          </View>

          {/* Calendario */}
          <ScrollView style={styles.calendarContainer}>
            <View style={styles.calendarGrid}>
              {calendarDays.map((day, index) => {
                const selected = isSelectedDay(day);
                const today = isToday(day);
                const weekend = isWeekend(day);

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dayCell,
                      selected && styles.selectedDayCell,
                      today && !selected && styles.todayDayCell,
                      weekend && !selected && styles.weekendDayCell,
                    ]}
                    onPress={() => handleDayPress(day)}
                    disabled={!day}
                  >
                    {day ? (
                      <Text
                        style={[
                          styles.dayText,
                          selected && styles.selectedDayText,
                          today && !selected && styles.todayDayText,
                          weekend && !selected && styles.weekendDayText,
                        ]}
                      >
                        {day}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Botón Cancelar */}
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.GRAY_DARK,
  },
  navButton: {
    padding: 8,
  },
  dayNamesRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  dayNameCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayNameText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.GRAY,
  },
  calendarContainer: {
    maxHeight: 320,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  selectedDayCell: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 8,
  },
  todayDayCell: {
    borderWidth: 2,
    borderColor: COLORS.PRIMARY,
    borderRadius: 8,
  },
  weekendDayCell: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
  },
  dayText: {
    fontSize: 14,
    color: COLORS.GRAY_DARK,
  },
  selectedDayText: {
    color: 'white',
    fontWeight: '600',
  },
  todayDayText: {
    color: COLORS.PRIMARY,
    fontWeight: '600',
  },
  weekendDayText: {
    color: '#92400E',
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.GRAY_LIGHT,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.GRAY_DARK,
  },
});

export default DatePickerModal;

