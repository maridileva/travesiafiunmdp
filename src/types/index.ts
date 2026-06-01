export type Role = 'admin' | 'docente' | 'tutor' | 'asesor_par' | 'estudiante';

export type RiskLevel = 'vigoroso' | 'moderado' | 'alto' | 'critico';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  assignedStudents?: string[]; // Para tutores y docentes
}

export interface StudentProfile {
  id: string;
  userId: string;
  career: string;
  score: number;
  riskLevel: RiskLevel;
  lastSurveyDate?: string;
  isSilentProfile: boolean;
  needsHelp: boolean;
  passedSubjects: number;
  expectedSubjects: number;
  tags?: string[];
}

export interface SubjectHistory {
  id: string;
  studentId: string;
  subjectId: string;
  status: 'aprobada' | 'regular' | 'cursando' | 'abandonada' | 'desaprobada';
  grade?: number;
  isUnreliable?: boolean;
}

export interface Subject {
  id: string;
  name: string;
  year: number;
  isCritical: boolean;
}

export interface Intervention {
  id: string;
  studentId: string;
  tutorId: string;
  date: string;
  summary: string;
  agreements: string;
  nextAction: string;
}

export interface AppState {
  currentUser: User | null;
  users: User[];
  students: StudentProfile[];
  subjects: Subject[];
  subjectHistory: SubjectHistory[];
  interventions: Intervention[];
  alertCount: number;
}
