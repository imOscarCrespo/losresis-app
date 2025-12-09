import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { ScreenLayout } from "../components/ScreenLayout";
import HospitalsScreen from "./HospitalsScreen";
import HospitalDetailScreen from "./HospitalDetailScreen";
import MirSimulatorScreen from "./MirSimulatorScreen";

export default function DashboardScreen() {
  const [currentScreen, setCurrentScreen] = useState("hospitals");
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState(null);

  const handleHospitalPress = () => {
    setCurrentScreen("hospitals");
    setSelectedHospital(null);
    setSelectedSpecialtyId(null);
  };

  const handleStudentPress = () => {
    setCurrentScreen("mirSimulator");
  };

  const handleReviewsPress = () => {
    // TODO: Navegar a pantalla de reseñas
    console.log("Navegar a Reseñas");
    setCurrentScreen("dashboard");
  };

  const handleHospitalSelect = (hospital, specialtyId) => {
    setSelectedHospital(hospital);
    setSelectedSpecialtyId(specialtyId || null);
    setCurrentScreen("hospitalDetail");
  };

  const handleBackFromDetail = () => {
    setSelectedHospital(null);
    setSelectedSpecialtyId(null);
    setCurrentScreen("hospitals");
  };

  const handleBackFromMirSimulator = () => {
    setCurrentScreen("hospitals");
  };

  // Si estamos en la pantalla de detalle del hospital
  if (currentScreen === "hospitalDetail" && selectedHospital) {
    return (
      <HospitalDetailScreen
        hospital={selectedHospital}
        selectedSpecialtyId={selectedSpecialtyId}
        onBack={handleBackFromDetail}
        onHospitalPress={handleHospitalPress}
        onStudentPress={handleStudentPress}
        onReviewsPress={handleReviewsPress}
      />
    );
  }

  // Si estamos en la pantalla de simulador MIR
  if (currentScreen === "mirSimulator") {
    return <MirSimulatorScreen onBack={handleBackFromMirSimulator} />;
  }

  // Si estamos en la pantalla de hospitales, renderizar HospitalsScreen directamente
  if (currentScreen === "hospitals") {
    return (
      <HospitalsScreen
        onHospitalSelect={handleHospitalSelect}
        onHospitalPress={handleHospitalPress}
        onStudentPress={handleStudentPress}
        onReviewsPress={handleReviewsPress}
      />
    );
  }

  return (
    <ScreenLayout
      onHospitalPress={handleHospitalPress}
      onStudentPress={handleStudentPress}
      onReviewsPress={handleReviewsPress}
      activeTab="hospital"
    >
      <View style={styles.content}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>
          Pantalla en blanco después del login
        </Text>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
});
