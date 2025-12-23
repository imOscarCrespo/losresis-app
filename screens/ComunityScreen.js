import React, { useMemo, useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Filters } from "../components/Filters";
import { useCommunityUsers } from "../hooks/useCommunityUsers";
import { useCities } from "../hooks/useCities";
import { useResidentReviewCheck } from "../hooks/useResidentReviewCheck";

const SCREEN_HEIGHT = Dimensions.get("window").height;

// Importar MapView con clustering
let MapView = null;
let Marker = null;
let Callout = null;
let PROVIDER_DEFAULT = null;
let MAP_AVAILABLE = false;

try {
  // Intentar primero con clustering
  try {
    const ClusteredMapView = require("react-native-map-clustering").default;
    MapView = ClusteredMapView;
    console.log("✅ MapView con clustering disponible");
  } catch (clusterError) {
    // Si no hay clustering, usar MapView normal
    const MapModule = require("react-native-maps");
    MapView = MapModule.default;
    console.log("✅ MapView sin clustering disponible");
  }

  // Importar componentes de react-native-maps
  const MapModule = require("react-native-maps");
  Marker = MapModule.Marker;
  Callout = MapModule.Callout;
  PROVIDER_DEFAULT = MapModule.PROVIDER_DEFAULT;
  MAP_AVAILABLE = true;
} catch (error) {
  console.log(
    "⚠️ MapView no disponible - usando vista de lista. Error:",
    error.message
  );
  MAP_AVAILABLE = false;
}

/**
 * Pantalla de Comunidad - Mapa interactivo de residentes
 */
export default function ComunityScreen({ userProfile, navigation }) {
  const mapRef = useRef(null);
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [viewMode, setViewMode] = useState("map"); // "map" o "list"

  // Hooks personalizados
  const { cityOptions, loading: citiesLoading } = useCities();
  const {
    users,
    specialties,
    loading: usersLoading,
    mapRegion,
  } = useCommunityUsers(selectedCity, selectedSpecialty);
  const { hasReview, loading: reviewLoading } = useResidentReviewCheck(
    userProfile?.id,
    userProfile
  );

  // Configurar filtros
  const filtersConfig = useMemo(() => {
    const specialtyOptions = specialties.map((specialty) => ({
      id: specialty.id,
      name: specialty.name,
    }));

    return [
      {
        id: "city",
        type: "select",
        label: "Ciudad",
        value: selectedCity,
        onSelect: setSelectedCity,
        options: cityOptions,
        placeholder: "Todas las ciudades",
      },
      {
        id: "specialty",
        type: "select",
        label: "Especialidad",
        value: selectedSpecialty,
        onSelect: setSelectedSpecialty,
        options: specialtyOptions,
        placeholder: "Todas las especialidades",
      },
    ];
  }, [selectedCity, selectedSpecialty, cityOptions, specialties]);

  // Verificar si hay filtros activos
  const hasActiveFilters = useMemo(() => {
    return !!(selectedCity || selectedSpecialty);
  }, [selectedCity, selectedSpecialty]);

  // Limpiar filtros
  const clearFilters = () => {
    setSelectedCity("");
    setSelectedSpecialty("");
  };

  // Ajustar el mapa cuando cambien los usuarios o filtros
  useEffect(() => {
    if (mapRef.current && users.length > 0) {
      // Pequeño delay para asegurar que el mapa esté listo
      setTimeout(() => {
        mapRef.current?.animateToRegion(mapRegion, 1000);
      }, 100);
    }
  }, [users, mapRegion]);

  // Determinar si debe mostrar blur/overlay (residente sin reseña)
  const shouldShowReviewPrompt =
    userProfile?.is_resident &&
    !userProfile?.is_super_admin &&
    !reviewLoading &&
    hasReview === false;

  // Renderizar marcador personalizado (solo si MapView está disponible)
  const renderMarker = (user) => {
    if (!MAP_AVAILABLE || !Marker) return null;

    return (
      <Marker
        key={user.id}
        coordinate={{
          latitude: user.latitude,
          longitude: user.longitude,
        }}
        pinColor="#007AFF"
      >
        {Callout && (
          <Callout tooltip={false}>
            <View style={styles.calloutContainer}>
              <Text style={styles.calloutName}>
                {user.name} {user.surname}
              </Text>
              {user.specialty_name && (
                <View style={styles.calloutRow}>
                  <Text style={styles.calloutLabel}>Especialidad:</Text>
                  <Text style={styles.calloutValue}>{user.specialty_name}</Text>
                </View>
              )}
              {user.work_email && (
                <View style={styles.calloutRow}>
                  <Text style={styles.calloutLabel}>Email:</Text>
                  <Text style={styles.calloutValue}>{user.work_email}</Text>
                </View>
              )}
              <View style={styles.calloutRow}>
                <Text style={styles.calloutLabel}>Ciudad:</Text>
                <Text style={styles.calloutValue}>{user.city}</Text>
              </View>
            </View>
          </Callout>
        )}
      </Marker>
    );
  };

  // Renderizar item de usuario en la lista (vista alternativa)
  const renderUserItem = ({ item }) => (
    <TouchableOpacity
      style={styles.userCard}
      activeOpacity={0.7}
      onPress={() => setSelectedMarker(item)}
    >
      <View style={styles.userCardHeader}>
        <View style={styles.userAvatar}>
          <Ionicons name="person" size={24} color="#007AFF" />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>
            {item.name} {item.surname}
          </Text>
          {item.specialty_name && (
            <View style={styles.userInfoRow}>
              <Ionicons
                name="school"
                size={14}
                color="#8B5CF6"
                style={styles.userInfoIcon}
              />
              <Text style={styles.userInfoText}>{item.specialty_name}</Text>
            </View>
          )}
          <View style={styles.userInfoRow}>
            <Ionicons
              name="location"
              size={14}
              color="#666"
              style={styles.userInfoIcon}
            />
            <Text style={styles.userInfoText}>{item.city}</Text>
          </View>
          {item.work_email && (
            <View style={styles.userInfoRow}>
              <Ionicons
                name="mail"
                size={14}
                color="#007AFF"
                style={styles.userInfoIcon}
              />
              <Text style={styles.userInfoText}>{item.work_email}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Comunidad</Text>
            <Text style={styles.resultsText}>
              Mostrando <Text style={styles.resultsNumber}>{users.length}</Text>{" "}
              {users.length === 1 ? "residente" : "residentes"}
            </Text>
          </View>
          <View style={styles.headerRight}>
            {/* Botón para cambiar vista */}
            {MAP_AVAILABLE && (
              <TouchableOpacity
                style={styles.viewToggleButton}
                onPress={() => setViewMode(viewMode === "map" ? "list" : "map")}
              >
                <Ionicons
                  name={viewMode === "map" ? "list" : "map"}
                  size={20}
                  color="#007AFF"
                />
                <Text style={styles.viewToggleText}>
                  {viewMode === "map" ? "Lista" : "Mapa"}
                </Text>
              </TouchableOpacity>
            )}
            {/* Botón de notificaciones */}
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => {
                // TODO: Implementar navegación a notificaciones
              }}
            >
              <Ionicons
                name="notifications-outline"
                size={28}
                color="#1a1a1a"
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Filtros */}
      <Filters
        filters={filtersConfig}
        onClearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Mapa o Lista */}
      <View style={styles.mapWrapper}>
        {MAP_AVAILABLE && MapView && viewMode === "map" ? (
          // Vista de Mapa con clustering
          <MapView
            ref={mapRef}
            style={[styles.map, shouldShowReviewPrompt && styles.mapBlurred]}
            provider={PROVIDER_DEFAULT}
            initialRegion={{
              latitude: 40.4168,
              longitude: -3.7038,
              latitudeDelta: 10,
              longitudeDelta: 10,
            }}
            showsUserLocation={false}
            showsMyLocationButton={false}
            zoomEnabled={!shouldShowReviewPrompt}
            scrollEnabled={!shouldShowReviewPrompt}
            pitchEnabled={false}
            rotateEnabled={false}
            // Configuración de clustering mejorada
            clusterColor="#007AFF"
            clusterTextColor="#FFFFFF"
            clusterFontFamily="System"
            radius={80} // Radio aumentado para agrupar mejor usuarios cercanos
            maxZoom={18} // Máximo zoom antes de desagrupar
            minZoom={3}
            extent={512}
            nodeSize={64}
            // Activar clustering más agresivo
            spiralEnabled={true}
            superClusterOptions={{
              radius: 80,
              maxZoom: 18,
              minZoom: 3,
              minPoints: 2, // Agrupar desde 2 puntos cercanos
            }}
            // Personalizar estilo del cluster
            renderCluster={(cluster) => {
              const { coordinate, pointCount, clusterId } = cluster;
              return (
                <Marker
                  key={`cluster-${clusterId}`}
                  coordinate={coordinate}
                  onPress={() => {
                    // Hacer zoom en el cluster
                    if (mapRef.current) {
                      const region = {
                        latitude: coordinate.latitude,
                        longitude: coordinate.longitude,
                        latitudeDelta: 0.5,
                        longitudeDelta: 0.5,
                      };
                      mapRef.current.animateToRegion(region, 300);
                    }
                  }}
                >
                  <View style={styles.clusterContainer}>
                    <View
                      style={[
                        styles.clusterBubble,
                        pointCount >= 10 && styles.clusterBubbleLarge,
                        pointCount >= 20 && styles.clusterBubbleXLarge,
                      ]}
                    >
                      <Text style={styles.clusterText}>{pointCount}</Text>
                      <Text style={styles.clusterSubtext}>
                        {pointCount === 2 ? "residentes" : "residentes"}
                      </Text>
                    </View>
                    {/* Indicador de zoom */}
                    <View style={styles.clusterHint}>
                      <Ionicons name="search" size={10} color="#007AFF" />
                      <Text style={styles.clusterHintText}>Haz zoom</Text>
                    </View>
                  </View>
                  {/* Callout informativo */}
                  {Callout && (
                    <Callout tooltip={false}>
                      <View style={styles.clusterCallout}>
                        <Text style={styles.clusterCalloutTitle}>
                          {pointCount} residentes en esta zona
                        </Text>
                        <Text style={styles.clusterCalloutText}>
                          Haz zoom para ver cada uno
                        </Text>
                      </View>
                    </Callout>
                  )}
                </Marker>
              );
            }}
          >
            {!shouldShowReviewPrompt && users.map((user) => renderMarker(user))}
          </MapView>
        ) : (
          // Vista de lista
          <View style={styles.listContainer}>
            {!shouldShowReviewPrompt && (
              <>
                {!MAP_AVAILABLE && (
                  <View style={styles.listHeader}>
                    <Ionicons
                      name="information-circle"
                      size={20}
                      color="#FF9500"
                    />
                    <Text style={styles.listHeaderText}>
                      Mapa no disponible. Ejecuta 'npx expo run:ios' para
                      habilitar el mapa
                    </Text>
                  </View>
                )}
                <FlatList
                  data={users}
                  renderItem={renderUserItem}
                  keyExtractor={(item) => item.id.toString()}
                  contentContainerStyle={styles.listContent}
                  ListEmptyComponent={
                    !usersLoading && (
                      <View style={styles.emptyContainer}>
                        <Ionicons
                          name="people-outline"
                          size={48}
                          color="#999"
                        />
                        <Text style={styles.emptyText}>
                          No se encontraron residentes con los filtros
                          seleccionados
                        </Text>
                      </View>
                    )
                  }
                />
              </>
            )}
          </View>
        )}

        {/* Overlay para residentes sin reseña */}
        {shouldShowReviewPrompt && (
          <View style={styles.reviewPromptOverlay}>
            <View style={styles.reviewPromptContent}>
              <View style={styles.reviewPromptIcon}>
                <Ionicons name="map" size={32} color="#FFFFFF" />
              </View>
              <Text style={styles.reviewPromptTitle}>
                ¡Descubre la comunidad!
              </Text>
              <Text style={styles.reviewPromptText}>
                Para acceder al mapa de la comunidad y ver dónde están tus
                compañeros residentes, primero comparte tu experiencia con una
                reseña.
              </Text>
              <TouchableOpacity
                style={styles.reviewPromptButton}
                onPress={() => navigation?.navigate("myReview")}
              >
                <Ionicons name="heart" size={20} color="#FFFFFF" />
                <Text style={styles.reviewPromptButtonText}>
                  Compartir mi experiencia
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Loading overlay */}
        {(usersLoading ||
          (userProfile?.is_resident &&
            !userProfile?.is_super_admin &&
            reviewLoading)) && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>
              {usersLoading ? "Cargando usuarios..." : "Verificando acceso..."}
            </Text>
          </View>
        )}

        {/* Mensaje cuando no hay usuarios (solo para vista de mapa) */}
        {MAP_AVAILABLE &&
          !usersLoading &&
          !shouldShowReviewPrompt &&
          users.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#999" />
              <Text style={styles.emptyText}>
                No se encontraron residentes con los filtros seleccionados
              </Text>
            </View>
          )}
      </View>
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
    paddingRight: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  notificationButton: {
    padding: 8,
  },
  viewToggleButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F8FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    marginLeft: 12,
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#007AFF",
  },
  resultsText: {
    fontSize: 14,
    color: "#666",
  },
  resultsNumber: {
    color: "#007AFF",
    fontWeight: "600",
  },
  mapWrapper: {
    flex: 1,
    position: "relative",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  mapBlurred: {
    opacity: 0.3,
  },
  // Estilos para Callout (popup del marcador)
  calloutContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 12,
    minWidth: 200,
    maxWidth: 300,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  calloutName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  calloutRow: {
    marginTop: 4,
  },
  calloutLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 2,
  },
  calloutValue: {
    fontSize: 13,
    color: "#1a1a1a",
  },
  // Estilos para clusters
  clusterContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  clusterBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  clusterBubbleLarge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#0056B3",
  },
  clusterBubbleXLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#003D82",
  },
  clusterText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  clusterSubtext: {
    fontSize: 9,
    color: "#FFFFFF",
    opacity: 0.9,
  },
  clusterHint: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
    gap: 3,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  clusterHintText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#007AFF",
  },
  clusterCallout: {
    padding: 10,
    minWidth: 150,
  },
  clusterCalloutTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  clusterCalloutText: {
    fontSize: 12,
    color: "#666",
  },
  reviewPromptOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  reviewPromptContent: {
    alignItems: "center",
    maxWidth: 400,
  },
  reviewPromptIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  reviewPromptTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 12,
    textAlign: "center",
  },
  reviewPromptText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  reviewPromptButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  reviewPromptButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  emptyContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: "#999",
    textAlign: "center",
  },
  // Estilos para vista de lista alternativa
  listContainer: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    backgroundColor: "#FFF9E6",
    borderBottomWidth: 1,
    borderBottomColor: "#FFE4A3",
    gap: 8,
  },
  listHeaderText: {
    fontSize: 13,
    color: "#666",
    fontStyle: "italic",
  },
  listContent: {
    padding: 16,
  },
  userCard: {
    backgroundColor: "#FFFFFF",
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
  userCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E3F2FD",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 6,
  },
  userInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  userInfoIcon: {
    marginRight: 6,
  },
  userInfoText: {
    fontSize: 13,
    color: "#666",
    flex: 1,
  },
});
