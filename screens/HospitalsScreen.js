import React, { useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Filters } from "../components/Filters";
import { ScreenHeader } from "../components/ScreenHeader";
import { useHospitals } from "../hooks/useHospitals";
import posthogLogger from "../services/posthogService";

export default function HospitalsScreen({
  onHospitalSelect,
  onSectionChange,
  currentSection,
  userProfile,
}) {
  const {
    filteredHospitals,
    specialties,
    searchTerm,
    setSearchTerm,
    selectedRegion,
    setSelectedRegion,
    selectedCity,
    setSelectedCity,
    selectedSpecialty,
    setSelectedSpecialty,
    uniqueRegions,
    availableCities,
    loadingHospitals,
    loadingSpecialties,
    loadingSpecialtyFilter,
    clearFilters,
  } = useHospitals();

  // Configurar los filtros para el componente genérico
  const filtersConfig = useMemo(() => {
    // Preparar opciones para los selects
    const regionOptions = uniqueRegions.map((region) => ({
      id: region,
      name: region,
    }));

    const cityOptions = availableCities.map((city) => ({
      id: city,
      name: city,
    }));

    const specialtyOptions = specialties.map((specialty) => ({
      id: specialty.id,
      name: specialty.name,
    }));

    return [
      {
        id: "search",
        type: "search",
        label: "Buscar por nombre",
        value: searchTerm,
        onChange: setSearchTerm,
        placeholder: "Hospital Universitario...",
      },
      {
        id: "specialty",
        type: "select",
        label: "Filtrar por especialidad",
        value: selectedSpecialty,
        onSelect: setSelectedSpecialty,
        options: specialtyOptions,
        placeholder: "Todas las especialidades",
      },
      {
        id: "region",
        type: "select",
        label: "Filtrar por comunidad autónoma",
        value: selectedRegion,
        onSelect: setSelectedRegion,
        options: regionOptions,
        placeholder: "Todas las comunidades autónomas",
      },
      {
        id: "city",
        type: "select",
        label: "Filtrar por ciudad",
        value: selectedCity,
        onSelect: setSelectedCity,
        options: cityOptions,
        placeholder: "Todas las ciudades",
      },
    ];
  }, [
    searchTerm,
    selectedRegion,
    selectedCity,
    selectedSpecialty,
    uniqueRegions,
    availableCities,
    specialties,
  ]);

  // Verificar si hay filtros activos
  const hasActiveFilters = useMemo(() => {
    return !!(
      searchTerm ||
      selectedRegion ||
      selectedCity ||
      selectedSpecialty
    );
  }, [searchTerm, selectedRegion, selectedCity, selectedSpecialty]);

  // Tracking de pantalla con PostHog
  useEffect(() => {
    posthogLogger.logScreen("HospitalsScreen");
  }, []);

  const handleHospitalItemPress = (hospital) => {
    if (onHospitalSelect) {
      onHospitalSelect(hospital, selectedSpecialty);
    }
  };

  const renderHospitalItem = ({ item }) => (
    <TouchableOpacity
      style={styles.hospitalCard}
      activeOpacity={0.7}
      onPress={() => handleHospitalItemPress(item)}
    >
      <Text style={styles.hospitalName}>{item.name}</Text>

      <View style={styles.hospitalInfoRow}>
        <Ionicons name="location" size={16} color="#666" style={styles.icon} />
        <Text style={styles.hospitalLocation}>
          {item.city}, {item.region}
        </Text>
      </View>

      {item.specialtyCount !== undefined && (
        <View style={styles.hospitalInfoRow}>
          <Ionicons
            name="school"
            size={16}
            color="#8B5CF6"
            style={styles.icon}
          />
          <Text style={styles.specialtyCount}>
            {item.specialtyCount} especialidades
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <ScreenHeader
        title="Hospitales"
        subtitle={`Mostrando ${filteredHospitals.length} hospitales`}
        notificationCount={0}
        onNotificationPress={() => {
          // TODO: Implementar navegación a notificaciones
        }}
      />

      {/* Filtros genéricos */}
      <Filters
        filters={filtersConfig}
        onClearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Lista de hospitales */}
      {loadingHospitals || loadingSpecialtyFilter ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando hospitales...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredHospitals}
          renderItem={renderHospitalItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No se encontraron hospitales</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1a1a1a",
    flex: 1,
  },
  profileButton: {
    padding: 4,
  },
  resultsText: {
    fontSize: 14,
    color: "#666",
  },
  resultsNumber: {
    color: "#007AFF",
    fontWeight: "600",
  },
  listContent: {
    padding: 16,
  },
  hospitalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  hospitalName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  hospitalInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  icon: {
    marginRight: 6,
  },
  hospitalLocation: {
    fontSize: 14,
    color: "#666",
  },
  specialtyCount: {
    fontSize: 14,
    color: "#8B5CF6",
    fontWeight: "400",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
  },
});
