import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
  TextInput,
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { useTeamShifts } from '../hooks/useTeamShifts';
import { supabase } from '../config/supabase';
import posthogLogger from '../services/posthogService';

// Configurar locale en español
LocaleConfig.locales['es'] = {
  monthNames: [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ],
  monthNamesShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  today: 'Hoy'
};
LocaleConfig.defaultLocale = 'es';

/**
 * Vista del calendario del equipo
 * Muestra las guardias del usuario y del equipo en un calendario
 */
export const TeamCalendarView = ({ userProfile, userShifts, onClose }) => {
  const userId = userProfile?.id;
  const hospitalId = userProfile?.hospital_id;
  const specialityId = userProfile?.speciality_id;

  // Obtener guardias del equipo
  const {
    teamShifts,
    loading,
    currentMonth,
    setCurrentMonth,
    currentYear,
    setCurrentYear,
  } = useTeamShifts(userId, hospitalId, specialityId);

  const [selectedSwapShift, setSelectedSwapShift] = useState(null);
  const [selectedPurchaseShift, setSelectedPurchaseShift] = useState(null);
  const [pendingSwapTargetIds, setPendingSwapTargetIds] = useState(new Set());
  const [requestedPurchaseIds, setRequestedPurchaseIds] = useState(new Set());

  // Fetch pending swap requests where user is the requester
  // Tracking de pantalla con PostHog
  useEffect(() => {
    posthogLogger.logScreen("TeamCalendarView");
  }, []);

  useEffect(() => {
    const fetchPendingSwapRequests = async () => {
      if (!userId || !userShifts || userShifts.length === 0) {
        setPendingSwapTargetIds(new Set());
        return;
      }

      try {
        const userShiftIds = userShifts.map((shift) => shift.id);
        if (userShiftIds.length === 0) {
          setPendingSwapTargetIds(new Set());
          return;
        }

        const { data, error } = await supabase
          .from('shift_swap_requests')
          .select('target_shift_id')
          .in('requester_shift_id', userShiftIds)
          .eq('status', 'pending');

        if (error) {
          console.error('Error fetching pending swap requests:', error);
          return;
        }

        const targetIds = new Set((data || []).map((req) => req.target_shift_id));
        setPendingSwapTargetIds(targetIds);
      } catch (error) {
        console.error('Exception fetching pending swap requests:', error);
      }
    };

    fetchPendingSwapRequests();
  }, [userId, userShifts]);

  // Fetch requested purchase IDs
  useEffect(() => {
    const fetchRequestedPurchases = async () => {
      if (!userId) return;

      try {
        const { data, error } = await supabase
          .from('shift_purchase_requests')
          .select('shift_id')
          .eq('buyer_id', userId)
          .eq('status', 'PENDING');

        if (error) {
          console.error('Error fetching requested purchases:', error);
          return;
        }

        const ids = new Set((data || []).map((req) => req.shift_id));
        setRequestedPurchaseIds(ids);
      } catch (error) {
        console.error('Exception fetching requested purchases:', error);
      }
    };

    fetchRequestedPurchases();
  }, [userId]);

  // Preparar marcas para el calendario
  const markedDates = useMemo(() => {
    const marks = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Añadir guardias del usuario
    userShifts.forEach((shift) => {
      const date = shift.date;
      const shiftDate = new Date(date);
      shiftDate.setHours(0, 0, 0, 0);

      // Solo mostrar guardias futuras
      if (shiftDate < today) return;

      if (!marks[date]) {
        marks[date] = { marked: true };
      }
    });

    // Añadir guardias del equipo
    teamShifts.forEach((shift) => {
      const date = shift.date;
      const shiftDate = new Date(date);
      shiftDate.setHours(0, 0, 0, 0);

      // Solo mostrar guardias futuras
      if (shiftDate < today) return;

      if (!marks[date]) {
        marks[date] = { marked: true };
      }
    });

    return marks;
  }, [userShifts, teamShifts]);

  // Obtener guardias para una fecha específica
  const getShiftsForDate = (date) => {
    const userShiftsForDate = userShifts.filter((shift) => shift.date === date);
    const teamShiftsForDate = teamShifts.filter((shift) => shift.date === date);
    return { userShiftsForDate, teamShiftsForDate };
  };

  const handleShiftPress = (shift) => {
    // Si es guardia del usuario, no hacer nada
    if (shift.user_id === userId) return;

    // Si ya está solicitada, no hacer nada
    if (pendingSwapTargetIds.has(shift.id) || requestedPurchaseIds.has(shift.id)) {
      return;
    }

    // Si tiene precio, mostrar modal de compra
    if (shift.price_eur !== null && shift.price_eur !== undefined) {
      setSelectedPurchaseShift(shift);
      return;
    }

    // Si no tiene precio, mostrar modal de intercambio
    setSelectedSwapShift(shift);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    const dayName = date.toLocaleDateString('es-ES', { weekday: 'long' });
    const capitalizedDayName = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    return `${capitalizedDayName}, ${day} de ${month} ${year}`;
  };

  const guardTypeLabels = {
    regular: 'Laborable',
    saturday: 'Sábado',
    sunday: 'Domingo',
  };

  const guardTypeColors = {
    regular: '#FFF3E0',
    saturday: '#FCE4EC',
    sunday: '#FFEBEE',
  };

  const guardTypeTextColors = {
    regular: '#E65100',
    saturday: '#C2185B',
    sunday: '#C62828',
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Guardias del Equipo</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={COLORS.GRAY_DARK} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
          <Text style={styles.loadingText}>Cargando guardias del equipo...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Guardias del Equipo</Text>
          <Text style={styles.subtitle}>
            Pulsa las guardias naranjas para solicitar intercambios
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={COLORS.GRAY_DARK} />
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.PRIMARY }]} />
          <Text style={styles.legendText}>Tus guardias</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.ORANGE }]} />
          <Text style={styles.legendText}>Guardias del equipo</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Calendar */}
        <View style={styles.calendarContainer}>
          <Calendar
            current={`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`}
            monthFormat={'MMMM yyyy'}
            hideArrows={false}
            renderArrow={(direction) => (
              <Ionicons
                name={direction === 'left' ? 'chevron-back' : 'chevron-forward'}
                size={24}
                color={COLORS.PRIMARY}
              />
            )}
            markedDates={markedDates}
            minDate={new Date().toISOString().split('T')[0]}
            theme={{
              todayTextColor: COLORS.PRIMARY,
              selectedDayBackgroundColor: COLORS.PRIMARY,
              selectedDayTextColor: COLORS.WHITE,
              arrowColor: COLORS.PRIMARY,
              monthTextColor: COLORS.GRAY_DARK,
              textMonthFontWeight: 'bold',
              textMonthFontSize: 18,
            }}
            onMonthChange={(month) => {
              setCurrentMonth(month.month - 1);
              setCurrentYear(month.year);
            }}
            dayComponent={({ date, state }) => {
              if (!date) return null;
              
              const dateString = date.dateString;
              const { userShiftsForDate: userShifts, teamShiftsForDate: teamShifts } = 
                getShiftsForDate(dateString);
              
              const isDisabled = state === 'disabled';
              const isToday = state === 'today';
              
              return (
                <View style={styles.dayCell}>
                  <Text
                    style={[
                      styles.dayText,
                      isDisabled && styles.dayTextDisabled,
                      isToday && styles.dayTextToday,
                    ]}
                  >
                    {date.day}
                  </Text>
                  <View style={styles.shiftsInDay}>
                    {userShifts.slice(0, 2).map((shift, index) => (
                      <View
                        key={`user-${shift.id}-${index}`}
                        style={[styles.shiftBadgeSmall, styles.userShiftBadge]}
                      >
                        <Text style={styles.shiftBadgeSmallText} numberOfLines={1}>
                          Tu guardia
                        </Text>
                      </View>
                    ))}
                    {teamShifts.slice(0, 2).map((shift, index) => (
                      <TouchableOpacity
                        key={`team-${shift.id}-${index}`}
                        style={[styles.shiftBadgeSmall, styles.teamShiftBadge]}
                        onPress={() => !isDisabled && handleShiftPress(shift)}
                        disabled={isDisabled}
                      >
                        <Text style={styles.shiftBadgeSmallText} numberOfLines={1}>
                          {shift.user_name || 'Compañero'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {(userShifts.length + teamShifts.length > 2) && (
                      <Text style={styles.moreShiftsText}>
                        +{userShifts.length + teamShifts.length - 2}
                      </Text>
                    )}
                  </View>
                </View>
              );
            }}
          />
        </View>
      </ScrollView>

      {/* Swap Request Modal */}
      {selectedSwapShift && (
        <SwapRequestModal
          shift={selectedSwapShift}
          userShifts={userShifts}
          onClose={() => setSelectedSwapShift(null)}
          onSwapRequestCreated={(targetShiftId) => {
            setPendingSwapTargetIds((prev) => new Set(prev).add(targetShiftId));
            setSelectedSwapShift(null);
          }}
          formatDate={formatDate}
          guardTypeLabels={guardTypeLabels}
          guardTypeColors={guardTypeColors}
          guardTypeTextColors={guardTypeTextColors}
        />
      )}

      {/* Purchase Request Modal */}
      {selectedPurchaseShift && (
        <PurchaseRequestModal
          shift={selectedPurchaseShift}
          userId={userId}
          onClose={() => setSelectedPurchaseShift(null)}
          onPurchaseCreated={(shiftId) => {
            setRequestedPurchaseIds((prev) => new Set(prev).add(shiftId));
            setSelectedPurchaseShift(null);
          }}
          formatDate={formatDate}
          guardTypeLabels={guardTypeLabels}
          guardTypeColors={guardTypeColors}
          guardTypeTextColors={guardTypeTextColors}
        />
      )}
    </View>
  );
};

// Modal para solicitar intercambio
const SwapRequestModal = ({
  shift,
  userShifts,
  onClose,
  onSwapRequestCreated,
  formatDate,
  guardTypeLabels,
  guardTypeColors,
  guardTypeTextColors,
}) => {
  const [selectedUserShift, setSelectedUserShift] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Filtrar guardias del usuario (solo futuras y de este mes y el siguiente)
  const availableGuards = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;

    return userShifts.filter((userShift) => {
      const shiftDate = new Date(userShift.date);
      const shiftDateOnly = new Date(
        shiftDate.getFullYear(),
        shiftDate.getMonth(),
        shiftDate.getDate()
      );
      const shiftMonth = shiftDate.getMonth();
      const shiftYear = shiftDate.getFullYear();

      return (
        ((shiftMonth === currentMonth && shiftYear === currentYear) ||
          (shiftMonth === nextMonth && shiftYear === nextYear)) &&
        shiftDateOnly >= today
      );
    });
  }, [userShifts]);

  const handleRequestSwap = async () => {
    if (!selectedUserShift) {
      setError('Por favor, selecciona una guardia para intercambiar');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('shift_swap_requests')
        .insert([
          {
            requester_shift_id: selectedUserShift,
            target_shift_id: shift.id,
            status: 'pending',
          },
        ]);

      if (error) {
        console.error('Error creating swap request:', error);
        Alert.alert('Error', 'No se pudo crear la solicitud de cambio');
        return;
      }

      Alert.alert('Éxito', 'Solicitud de intercambio enviada correctamente');
      onSwapRequestCreated(shift.id);
    } catch (error) {
      console.error('Exception creating swap request:', error);
      Alert.alert('Error', 'No se pudo crear la solicitud de cambio');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Solicitar Cambio de Guardia</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color={COLORS.GRAY_DARK} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalSubtitle}>
              Solicita un intercambio de guardia con {shift.user_name} {shift.user_surname}
            </Text>

            {/* Shift Details */}
            <View style={styles.shiftDetailCard}>
              <Text style={styles.shiftDetailTitle}>Detalles de la guardia</Text>
              <Text style={styles.shiftDetailDate}>{formatDate(shift.date)}</Text>
              <View
                style={[
                  styles.shiftTypeBadge,
                  { backgroundColor: guardTypeColors[shift.type] },
                ]}
              >
                <Text
                  style={[
                    styles.shiftTypeBadgeText,
                    { color: guardTypeTextColors[shift.type] },
                  ]}
                >
                  {guardTypeLabels[shift.type]}
                </Text>
              </View>
            </View>

            {/* User Shift Selection */}
            <Text style={styles.inputLabel}>Selecciona tu guardia para intercambiar</Text>
            <ScrollView
              style={styles.shiftsSelectContainer}
              showsVerticalScrollIndicator={false}
            >
              {availableGuards.length === 0 ? (
                <Text style={styles.noShiftsText}>
                  No tienes guardias disponibles para intercambiar
                </Text>
              ) : (
                availableGuards.map((userShift) => (
                  <TouchableOpacity
                    key={userShift.id}
                    style={[
                      styles.shiftSelectOption,
                      selectedUserShift === userShift.id && styles.shiftSelectOptionSelected,
                    ]}
                    onPress={() => {
                      setSelectedUserShift(userShift.id);
                      setError('');
                    }}
                  >
                    <View style={styles.shiftSelectContent}>
                      <Text style={styles.shiftSelectDate}>{formatDate(userShift.date)}</Text>
                      <View
                        style={[
                          styles.shiftTypeBadgeSmall,
                          { backgroundColor: guardTypeColors[userShift.type] },
                        ]}
                      >
                        <Text
                          style={[
                            styles.shiftTypeBadgeTextSmall,
                            { color: guardTypeTextColors[userShift.type] },
                          ]}
                        >
                          {guardTypeLabels[userShift.type]}
                        </Text>
                      </View>
                    </View>
                    {selectedUserShift === userShift.id && (
                      <Ionicons name="checkmark-circle" size={24} color={COLORS.SUCCESS} />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            {error && <Text style={styles.errorText}>{error}</Text>}

            {/* Info message */}
            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={20} color={COLORS.PRIMARY} />
              <Text style={styles.infoText}>
                Se enviará una solicitud a {shift.user_name} {shift.user_surname}. Podrás ver el
                estado en la sección de guardias.
              </Text>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancelButton} onPress={onClose}>
              <Text style={styles.modalCancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSubmitButton, submitting && styles.modalSubmitButtonDisabled]}
              onPress={handleRequestSwap}
              disabled={submitting || availableGuards.length === 0}
            >
              <Text style={styles.modalSubmitButtonText}>
                {submitting ? 'Enviando...' : 'Solicitar Cambio'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Modal para solicitar compra
const PurchaseRequestModal = ({
  shift,
  userId,
  onClose,
  onPurchaseCreated,
  formatDate,
  guardTypeLabels,
  guardTypeColors,
  guardTypeTextColors,
}) => {
  const [submitting, setSubmitting] = useState(false);

  const amount = shift.price_eur !== null && shift.price_eur !== undefined ? Number(shift.price_eur) : 0;

  const handleRequestPurchase = async () => {
    if (amount <= 0) {
      Alert.alert('Error', 'Esta guardia no tiene un precio disponible');
      return;
    }

    setSubmitting(true);
    const roundedAmount = Math.round(amount * 100) / 100;

    try {
      const { error } = await supabase
        .from('shift_purchase_requests')
        .insert([
          {
            shift_id: shift.id,
            buyer_id: userId,
            owner_id: shift.user_id,
            offered_price_eur: roundedAmount,
            status: 'PENDING',
          },
        ]);

      if (error) {
        console.error('Error creating purchase request:', error);
        if (error.code === '23505') {
          Alert.alert('Error', 'Ya has solicitado comprar esta guardia');
        } else {
          Alert.alert('Error', 'No se pudo enviar la solicitud de compra');
        }
        return;
      }

      Alert.alert('Éxito', 'Solicitud de compra enviada correctamente');
      onPurchaseCreated(shift.id);
    } catch (error) {
      console.error('Exception creating purchase request:', error);
      Alert.alert('Error', 'No se pudo enviar la solicitud de compra');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Solicitar Compra de Guardia</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color={COLORS.GRAY_DARK} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalSubtitle}>
              Enviaremos una solicitud para que puedas cubrir esta guardia remunerada
            </Text>

            {/* Shift Details */}
            <View style={styles.shiftDetailCard}>
              <Text style={styles.shiftDetailTitle}>Detalles de la guardia</Text>
              <Text style={styles.shiftDetailDate}>{formatDate(shift.date)}</Text>
              <View style={styles.shiftCardHeader}>
                <View
                  style={[
                    styles.shiftTypeBadge,
                    { backgroundColor: guardTypeColors[shift.type] },
                  ]}
                >
                  <Text
                    style={[
                      styles.shiftTypeBadgeText,
                      { color: guardTypeTextColors[shift.type] },
                    ]}
                  >
                    {guardTypeLabels[shift.type]}
                  </Text>
                </View>
                <Text style={styles.shiftUserNameSmall}>
                  Publicada por {shift.user_name} {shift.user_surname}
                </Text>
              </View>
            </View>

            {/* Price */}
            <View style={styles.priceCard}>
              <Text style={styles.priceCardTitle}>Ingreso estimado</Text>
              <View style={styles.priceCardContent}>
                <Ionicons name="cash" size={32} color={COLORS.SUCCESS} />
                <Text style={styles.priceCardAmount}>€{amount.toFixed(2)}</Text>
              </View>
              <Text style={styles.priceCardSubtext}>
                Recibirás este importe si el compañero acepta la solicitud
              </Text>
            </View>

            {/* Info message */}
            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={20} color={COLORS.PRIMARY} />
              <Text style={styles.infoText}>
                Se enviará la solicitud para ejercer esta guardia. Cuando el compañero la acepte,
                coordinaremos el pago entre ambos.
              </Text>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancelButton} onPress={onClose}>
              <Text style={styles.modalCancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSubmitButton, submitting && styles.modalSubmitButtonDisabled]}
              onPress={handleRequestPurchase}
              disabled={submitting}
            >
              <Text style={styles.modalSubmitButtonText}>
                {submitting ? 'Enviando...' : 'Solicitar Compra'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.WHITE,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.GRAY_DARK,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.GRAY,
  },
  closeButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.GRAY,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    gap: 24,
    backgroundColor: COLORS.WHITE,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 14,
    color: COLORS.GRAY_DARK,
  },
  scrollView: {
    flex: 1,
  },
  calendarContainer: {
    backgroundColor: COLORS.WHITE,
    margin: 16,
    borderRadius: 16,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  shiftsContainer: {
    padding: 16,
  },
  shiftsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.GRAY_DARK,
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.GRAY,
    textAlign: 'center',
  },
  shiftsSection: {
    marginBottom: 24,
  },
  shiftsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.GRAY_DARK,
    marginBottom: 12,
  },
  shiftCard: {
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
  userShiftCard: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.PRIMARY,
  },
  teamShiftCard: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.ORANGE,
  },
  disabledShiftCard: {
    opacity: 0.6,
  },
  shiftCardContent: {
    gap: 8,
  },
  shiftCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  shiftUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.GRAY_DARK,
    flex: 1,
  },
  shiftUserNameSmall: {
    fontSize: 12,
    color: COLORS.GRAY,
  },
  priceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.SUCCESS,
  },
  shiftTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  shiftTypeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  shiftTypeBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  shiftTypeBadgeTextSmall: {
    fontSize: 11,
    fontWeight: '600',
  },
  shiftNotes: {
    fontSize: 14,
    color: COLORS.GRAY,
  },
  pendingText: {
    fontSize: 12,
    color: COLORS.GRAY,
    fontStyle: 'italic',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.GRAY_DARK,
    flex: 1,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.GRAY,
    marginBottom: 20,
  },
  shiftDetailCard: {
    backgroundColor: '#FFF8F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFE4CC',
  },
  shiftDetailTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.GRAY,
    marginBottom: 8,
  },
  shiftDetailDate: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.GRAY_DARK,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.GRAY_DARK,
    marginBottom: 12,
  },
  shiftsSelectContainer: {
    maxHeight: 200,
    marginBottom: 16,
  },
  noShiftsText: {
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: 'center',
    padding: 20,
  },
  shiftSelectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.BORDER,
    marginBottom: 8,
  },
  shiftSelectOptionSelected: {
    borderColor: COLORS.SUCCESS,
    backgroundColor: '#F0FDF4',
  },
  shiftSelectContent: {
    flex: 1,
    gap: 8,
  },
  shiftSelectDate: {
    fontSize: 14,
    color: COLORS.GRAY_DARK,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 14,
    color: COLORS.ERROR,
    marginBottom: 16,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  priceCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    alignItems: 'center',
  },
  priceCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.GRAY,
    marginBottom: 12,
  },
  priceCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  priceCardAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.SUCCESS,
  },
  priceCardSubtext: {
    fontSize: 12,
    color: COLORS.GRAY,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.GRAY_DARK,
  },
  modalSubmitButton: {
    flex: 1,
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalSubmitButtonDisabled: {
    backgroundColor: COLORS.GRAY,
  },
  modalSubmitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  // Day cell styles
  dayCell: {
    width: 50,
    height: 80,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayCellSelected: {
    backgroundColor: COLORS.PRIMARY + '20',
    borderRadius: 8,
  },
  dayText: {
    fontSize: 14,
    color: COLORS.GRAY_DARK,
    marginBottom: 4,
  },
  dayTextDisabled: {
    color: COLORS.GRAY + '80',
  },
  dayTextToday: {
    color: COLORS.PRIMARY,
    fontWeight: 'bold',
  },
  dayTextSelected: {
    color: COLORS.PRIMARY,
    fontWeight: 'bold',
  },
  shiftsInDay: {
    width: '100%',
    gap: 2,
  },
  shiftBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    width: '100%',
    borderWidth: 1,
  },
  userShiftBadge: {
    backgroundColor: '#2196F3',
    borderColor: '#1976D2',
  },
  teamShiftBadge: {
    backgroundColor: '#FFB74D',
    borderColor: '#F57C00',
  },
  shiftBadgeSmallText: {
    fontSize: 9,
    color: '#1a1a1a',
    fontWeight: '700',
    textAlign: 'center',
  },
  moreShiftsText: {
    fontSize: 8,
    color: COLORS.GRAY,
    textAlign: 'center',
    marginTop: 2,
  },
});

