import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { DashPlanAdmin } from './DashPlanAdmin';
import { DashPlanEstudiante } from './DashPlanEstudiante';
import { Navigate } from 'react-router-dom';

export const PlanSelector = () => {
  const { usuario, rol, loading } = useAuth();

  if (loading) return <div>Cargando...</div>;
  if (!usuario) return <Navigate to="/login" replace />;

  if (rol === 'admin') {
    return <DashPlanAdmin />;
  } else if (rol === 'estudiante') {
    return <DashPlanEstudiante />;
  }

  // Fallback for other roles (could be read-only view later)
  return (
    <div className="text-center text-gray-500 mt-20">
      No tenés permisos para ver esta sección.
    </div>
  );
};
