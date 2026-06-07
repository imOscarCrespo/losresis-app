import { useState, useCallback, useEffect, useMemo } from "react";
import {
  getConsent,
  saveConsent,
  getAssessments,
  saveAssessment,
  deleteAllAssessments,
  isAssessmentDueThisMonth,
  CONSENT_VERSION,
} from "../services/mentalHealthService";

/**
 * Hook para gestionar la sección de Salud mental del residente.
 * @param {string} userId
 */
export const useMentalHealth = (userId) => {
  const [assessments, setAssessments] = useState([]);
  const [consent, setConsent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!userId) {
      setAssessments([]);
      setConsent(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [consentRow, assessmentRows] = await Promise.all([
        getConsent(userId),
        getAssessments(userId),
      ]);
      setConsent(consentRow);
      setAssessments(assessmentRows);
    } catch (err) {
      console.error("Exception loading mental health data:", err);
      setError("No pudimos cargar tus datos de bienestar");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const handleSaveConsent = useCallback(async () => {
    if (!userId) return false;

    setSaving(true);
    setError(null);
    try {
      const row = await saveConsent(userId);
      setConsent(row);
      return true;
    } catch (err) {
      console.error("Exception saving consent:", err);
      setError("No pudimos guardar tu consentimiento");
      return false;
    } finally {
      setSaving(false);
    }
  }, [userId]);

  const handleSaveAssessment = useCallback(
    async (answers) => {
      if (!userId) return null;

      setSaving(true);
      setError(null);
      try {
        const created = await saveAssessment(userId, answers);
        setAssessments((prev) => [created, ...prev]);
        return created;
      } catch (err) {
        console.error("Exception saving assessment:", err);
        setError("No pudimos guardar tu evaluación");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [userId]
  );

  const handleDeleteAllData = useCallback(async () => {
    if (!userId) return false;

    setSaving(true);
    setError(null);
    try {
      await deleteAllAssessments(userId);
      setAssessments([]);
      return true;
    } catch (err) {
      console.error("Exception deleting mental health data:", err);
      setError("No pudimos borrar tu historial");
      return false;
    } finally {
      setSaving(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const hasConsented = useMemo(
    () => consent?.version === CONSENT_VERSION,
    [consent]
  );
  const lastAssessment = assessments[0] || null;
  const isDueThisMonth = useMemo(
    () => isAssessmentDueThisMonth(assessments),
    [assessments]
  );

  return {
    assessments,
    lastAssessment,
    consent,
    hasConsented,
    isDueThisMonth,
    loading,
    saving,
    error,
    fetchAll,
    saveConsent: handleSaveConsent,
    saveAssessment: handleSaveAssessment,
    deleteAllData: handleDeleteAllData,
  };
};
