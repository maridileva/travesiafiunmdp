import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { DashEstudiante } from './DashEstudiante';
import { DashTutor } from './DashTutor';
import { DashAdmin } from './DashAdmin';
import { DashDocente } from './DashDocente';

export const DashboardSelector = () => {
  const { rol } = useAuth();

  switch (rol) {
    case 'estudiante':
      return <DashEstudiante />;
    case 'tutor':
    case 'asesor_par':
      return <DashTutor />;
    case 'docente':
      return <DashDocente />;
    case 'admin':
      return <DashAdmin />;
    default:
      return <div>Cargando dashboard... o rol no reconocido ({rol}).</div>;
  }
};
