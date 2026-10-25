import { useCallback, useEffect, useRef, useState } from "react";
import { getMyRotationAssessments } from "../services/rotationAssessmentService";

/**
 * Las rotaciones publicadas por Docencia para un año y las autoevaluaciones del
 * residente de ese año. Solo pinta la respuesta de la última petición: cambiar
 * de año deprisa no puede dejar en pantalla las rotaciones del año anterior.
 */
export const useRotationAssessments = (residencyYear, enabled = true) => {
  const [data, setData] = useState({ context: null, rotations: [], assessments: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const requestRef = useRef(0);

  const reload = useCallback(async () => {
    if (!enabled || !residencyYear) return;
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await getMyRotationAssessments(residencyYear);
      if (request === requestRef.current) setData(result);
    } catch (loadError) {
      if (request === requestRef.current) setError(loadError);
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [enabled, residencyYear]);

  useEffect(() => {
    setData({ context: null, rotations: [], assessments: [] });
    reload();
  }, [reload]);

  /** Sustituye una autoevaluación tras guardarla, sin volver a pedir todo. */
  const replaceAssessment = useCallback((row) => {
    if (!row?.id) return;
    setData((current) => {
      const existing = current.assessments.find((item) => item.id === row.id);
      if (existing) {
        return {
          ...current,
          assessments: current.assessments.map((item) =>
            item.id === row.id
              ? { ...item, ...row, version: item.version, content: item.content }
              : item
          ),
        };
      }
      return current;
    });
  }, []);

  return { ...data, loading, error, reload, replaceAssessment };
};

export default useRotationAssessments;
