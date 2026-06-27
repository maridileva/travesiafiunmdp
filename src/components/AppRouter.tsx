import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { signIn, signOut } from '../services/authService';
import { FloatingDock } from './ui/floating-dock';
import { motion } from 'framer-motion';
import { Home, BookOpen, ClipboardList, HelpCircle, User, Users, Bell, BarChart2, TrendingDown, LogOut, Compass, Mail, Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/moving-border';
import { DashboardSelector } from './dashboards/DashboardSelector';
import { supabase } from '../lib/supabase';
import { PlanSelector } from './dashboards/PlanSelector';
import { Encuestas } from './dashboards/Encuestas';
import { DashEncuestasAdmin } from './dashboards/DashEncuestasAdmin';
import { ImportarAlumnos } from './dashboards/ImportarAlumnos';
import { EncuestaInicial } from './dashboards/EncuestaInicial';
import { Configuracion } from './dashboards/Configuracion';
import { Settings as SettingsIcon } from 'lucide-react';

  // Login Component
const Login = () => {// Login Component — versión demo con acceso rápido por rol
// Reemplaza el componente Login en src/components/AppRouter.tsx

const Login = () => {
  const { usuario, rol, loading } = useAuth();
  const [errorLogin, setErrorLogin] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Credenciales de demo por rol
  // IMPORTANTE: reemplazá estos emails/passwords con los que funcionen en tu Supabase
  const DEMO_USERS = {
    admin:      { email: 'admin@admin.com',                password: 'demo1234' },
    tutor:      { email: 'tutor.carlos@fi.mdp.edu.ar',    password: 'demo1234' },
    estudiante: { email: 'camila.torres@fi.mdp.edu.ar',   password: 'demo1234' },
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0F1B2D]"><div className="skeleton h-32 w-32 rounded-full"></div></div>;
  }

  if (usuario && rol) {
    return <Navigate to="/dashboard" replace />;
  }

  if (usuario && !rol) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0F1B2D] text-white p-4 text-center"><div><h2 className="text-xl font-bold text-red-500 mb-2">Error de acceso</h2><p>Su usuario no tiene un rol asignado en el sistema.</p><button onClick={() => signOut()} className="btn btn-outline mt-4 text-gray-300">Cerrar sesión</button></div></div>;
  }

  const loginAs = async (role: 'admin' | 'tutor' | 'estudiante') => {
    setErrorLogin(null);
    setIsSubmitting(true);
    try {
      const { email, password } = DEMO_USERS[role];
      const { error } = await signIn(email, password);
      if (error) throw error;
    } catch (err: any) {
      setErrorLogin(err.message || 'Error al iniciar sesión');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorLogin(null);
    setIsSubmitting(true);
    const email = (e.currentTarget.elements.namedItem('email') as HTMLInputElement).value;
    const password = (e.currentTarget.elements.namedItem('password') as HTMLInputElement).value;
    try {
      const { error } = await signIn(email, password);
      if (error) throw error;
    } catch (err: any) {
      setErrorLogin(err.message || 'Error en la autenticación');
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleCards = [
    {
      role: 'admin' as const,
      label: 'Administrador',
      description: 'Panel global, métricas y configuración',
      icon: '🏛️',
      color: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 hover:border-blue-400/60',
      textColor: 'text-blue-400',
    },
    {
      role: 'tutor' as const,
      label: 'Tutor',
      description: 'Seguimiento de alumnos y alertas',
      icon: '👩‍🏫',
      color: 'from-teal-500/20 to-teal-600/10 border-teal-500/30 hover:border-teal-400/60',
      textColor: 'text-teal-400',
    },
    {
      role: 'estudiante' as const,
      label: 'Estudiante',
      description: 'Mi perfil, plan y encuestas',
      icon: '🎓',
      color: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 hover:border-purple-400/60',
      textColor: 'text-purple-400',
    },
  ];

  return (
    <>
      <div className="fixed inset-0 z-0 pointer-events-none bg-[#0F1B2D]">
        <div className="absolute top-[-20%] left-[10%] w-[500px] h-[500px] bg-[rgba(59,130,246,0.15)] rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] bg-[rgba(20,184,166,0.15)] rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-lg"
        >
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-teal-500/10 border border-teal-500/20 mb-4">
              <Compass className="w-7 h-7 text-teal-400" />
            </div>
            <h1 className="font-display text-3xl font-semibold text-white tracking-tight text-center">
              Travesía
            </h1>
            <p className="font-sans text-sm text-slate-500 mt-2 text-center">
              Sistema de Seguimiento Estudiantil · FI-UNMdP
            </p>
          </div>

          {/* Demo role cards */}
          {!showManual && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <p className="text-center text-xs text-slate-500 uppercase tracking-wider mb-4 font-sans">
                Acceder como
              </p>
              <div className="grid grid-cols-1 gap-3">
                {roleCards.map(({ role, label, description, icon, color, textColor }) => (
                  <button
                    key={role}
                    onClick={() => loginAs(role)}
                    disabled={isSubmitting}
                    className={`w-full p-4 rounded-xl bg-gradient-to-r ${color} border transition-all duration-200 text-left flex items-center gap-4 group disabled:opacity-50`}
                  >
                    <span className="text-2xl">{icon}</span>
                    <div className="flex-1">
                      <p className={`font-semibold text-sm ${textColor}`}>{label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{description}</p>
                    </div>
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
                    ) : (
                      <span className="text-slate-600 group-hover:text-slate-400 transition-colors">→</span>
                    )}
                  </button>
                ))}
              </div>

              {errorLogin && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 flex items-start gap-3 mt-4"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-red-400 text-sm font-sans">{errorLogin}</p>
                </motion.div>
              )}

              <div className="mt-6 text-center">
                <button
                  onClick={() => setShowManual(true)}
                  className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-sans"
                >
                  Iniciar sesión con email y contraseña
                </button>
              </div>
            </motion.div>
          )}

          {/* Login manual (oculto por defecto) */}
          {showManual && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6"
            >
              <form className="space-y-5" onSubmit={handleManualAuth}>
                <div>
                  <label className="block font-sans text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="w-4 h-4 text-slate-600" />
                    </div>
                    <input
                      name="email"
                      type="email"
                      required
                      className="block w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 pl-10 text-slate-100 font-sans text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all duration-200"
                      placeholder="usuario@fi.mdp.edu.ar"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-sans text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                    Contraseña
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="w-4 h-4 text-slate-600" />
                    </div>
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      className="block w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 pl-10 pr-10 text-slate-100 font-sans text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-all duration-200"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-600 hover:text-slate-400 transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {errorLogin && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    <p className="text-red-400 text-sm font-sans">{errorLogin}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full btn bg-teal-600 hover:bg-teal-500 border-none text-white font-sans"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ingresar'}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={() => { setShowManual(false); setErrorLogin(null); }}
                  className="text-xs text-slate-600 hover:text-slate-400 transition-colors font-sans"
                >
                  ← Volver a acceso rápido
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </>
  );
};
};

// Layout Principal
const AppLayout = () => {
  const { usuario, rol, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0F1B2D]"><div className="skeleton h-32 w-32 rounded-full"></div></div>;
  }
  
  if (!usuario || (!rol && !loading)) {
    return <Navigate to="/login" replace />;
  }

  const isEstudiante = rol === 'estudiante';
  const isTutor = rol === 'tutor' || rol === 'asesor_par';
  const isDocente = rol === 'docente';
  const isAdmin = rol === 'admin';

  let dockItems = [];
  
  // Fake alert count for now, since useAlertas is not fully integrated yet
  const alertCount = 0; 

  if (isEstudiante) {
    dockItems = [
      { title: "Inicio", icon: <Home className="w-5 h-5" />, href: "/dashboard" },
      { title: "Mi plan", icon: <BookOpen className="w-5 h-5" />, href: "/plan" },
      { title: "Encuestas", icon: <ClipboardList className="w-5 h-5" />, href: "/encuestas" },
      { title: "Pedir ayuda", icon: <HelpCircle className="w-5 h-5 text-teal-400" />, href: "/ayuda" },
      { title: "Salir", icon: <LogOut className="w-5 h-5" />, href: "/logout" },
    ];
  } else if (isTutor) {
    dockItems = [
      { title: "Inicio", icon: <Home className="w-5 h-5" />, href: "/dashboard" },
      { title: "Mis alumnos", icon: <Users className="w-5 h-5" />, href: "/alumnos" },
      { title: "Alertas", icon: <div className="relative"><Bell className="w-5 h-5" />{alertCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 w-4 h-4 rounded-full text-[10px] flex items-center justify-center text-white">{alertCount}</span>}</div>, href: "/alertas" },
      { title: "Intervenciones", icon: <ClipboardList className="w-5 h-5" />, href: "/intervenciones" },
      { title: "Salir", icon: <LogOut className="w-5 h-5" />, href: "/logout" },
    ];
  } else if (isDocente) {
    dockItems = [
      { title: "Cohorte", icon: <BarChart2 className="w-5 h-5" />, href: "/dashboard" },
      { title: "Materias", icon: <BookOpen className="w-5 h-5" />, href: "/materias" },
      { title: "Reportes", icon: <TrendingDown className="w-5 h-5" />, href: "/reportes" },
      { title: "Salir", icon: <LogOut className="w-5 h-5" />, href: "/logout" },
    ];
  } else if (isAdmin) {
    dockItems = [
      { title: "Inicio", icon: <Home className="w-5 h-5" />, href: "/dashboard" },
      { title: "Plan", icon: <BookOpen className="w-5 h-5" />, href: "/plan" },
      { title: "Encuestas", icon: <ClipboardList className="w-5 h-5" />, href: "/encuestas" },
      { title: "Usuarios", icon: <Users className="w-5 h-5" />, href: "/usuarios" },
      { title: "Ajustes", icon: <SettingsIcon className="w-5 h-5" />, href: "/configuracion" },
      { title: "Salir", icon: <LogOut className="w-5 h-5" />, href: "/logout" },
    ];
  }

  return (
    <div className="flex h-screen overflow-hidden relative">
      <div className="fixed inset-0 z-0 pointer-events-none bg-[#0F1B2D]">
        <div className="absolute top-[-20%] left-[10%] w-[500px] h-[500px] bg-[rgba(59,130,246,0.15)] rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] bg-[rgba(20,184,166,0.15)] rounded-full blur-[100px]" />
      </div>
      <div className="flex-1 overflow-y-scroll w-full pb-24 relative z-10">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          <Outlet />
        </div>
        <FloatingDock items={dockItems} desktopClassName="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900/80 backdrop-blur-md" mobileClassName="hidden" />
        <div className="md:hidden btm-nav btm-nav-md bg-gray-900 border-t border-gray-800 z-50">
           {dockItems.map((item, idx) => (
              <Link key={idx} to={item.href} className="text-gray-400 hover:text-blue-400">
                 {item.icon}
                 <span className="btm-nav-label text-[10px]">{item.title}</span>
              </Link>
           ))}
        </div>
      </div>
    </div>
  );
};

const EncuestasSelector = () => {
  const { rol } = useAuth();
  if (rol === 'admin') {
    return <DashEncuestasAdmin />;
  }
  return <Encuestas />;
};

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardSelector />} />
          <Route path="plan" element={<PlanSelector />} />
          <Route path="encuestas" element={<EncuestasSelector />} />
          <Route path="encuesta-inicial" element={<EncuestaInicial />} />
          <Route path="ayuda" element={<Placeholder title="Pedir Ayuda" />} />
          <Route path="alumnos" element={<Placeholder title="Mis Alumnos" />} />
          <Route path="alertas" element={<Placeholder title="Alertas" />} />
          <Route path="intervenciones" element={<Placeholder title="Intervenciones" />} />
          <Route path="materias" element={<Placeholder title="Materias" />} />
          <Route path="reportes" element={<Placeholder title="Reportes" />} />
          <Route path="usuarios" element={<Placeholder title="Usuarios" />} />
          <Route path="configuracion" element={<Configuracion />} />
          <Route path="importar-alumnos" element={<ImportarAlumnos />} />
        </Route>
        <Route path="/logout" element={<Logout />} />
      </Routes>
    </BrowserRouter>
  );
};

const Logout = () => {
  React.useEffect(() => {
    signOut();
  }, []);
  return <Navigate to="/login" replace />;
};

const Placeholder = ({ title }: { title: string }) => {
  const { usuario, rol } = useAuth();
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
      <p className="text-gray-400">Bienvenido, {usuario?.email} ({rol})</p>
      <div className="mt-8 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <div className="h-48 rounded-2xl bg-gray-800/50 border border-gray-700 animate-pulse"></div>
        <div className="h-48 rounded-2xl bg-gray-800/50 border border-gray-700 animate-pulse"></div>
        <div className="h-48 rounded-2xl bg-gray-800/50 border border-gray-700 animate-pulse hidden md:block"></div>
      </div>
    </div>
  );
}

