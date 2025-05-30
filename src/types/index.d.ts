
export interface EducationItem {
  id: string;
  degree: string;
  institution: string;
  yearOfCompletion: string;
  details?: string;
}

export interface ExperienceItem {
  id: string;
  jobTitle: string;
  companyName: string;
  startDate: string;
  endDate: string; // Could be 'Present'
  description?: string;
}

export interface ProjectItem {
  id: string;
  title: string;
  description: string;
  technologiesUsed?: string[];
  projectUrl?: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  name?: string;
  profileField?: string; 
  role?: string; 
  company?: string | null;
  phoneNumber?: string | null;
  
  keySkills?: string[];
  experiences?: ExperienceItem[];
  projects?: ProjectItem[];
  educationHistory?: EducationItem[];
  accomplishments?: string;

  resumeFileName?: string | null; 
  resumeFileUrl?: string | null; 
  resumeStoragePath?: string | null; 
  resumeProcessedText?: string | null; // Text extracted client-side for AI

  createdAt: string;
  interviewsTaken?: number;
  isPlusSubscriber?: boolean;
  subscriptionPlan?: 'monthly' | 'quarterly' | 'yearly' | null;
  isAdmin?: boolean;
  updatedAt?: string;
}

export interface InterviewSession {
  id: string;
  userId: string;
  duration: 15 | 30 | 45; // minutes
  status: "pending" | "questions_generated" | "started" | "completed" | "cancelled";
  questions?: GeneratedQuestion[]; 
  transcript?: string; 
  feedback?: InterviewFeedback;
  createdAt: string;
  updatedAt?: string;
  endedReason?: "completed_by_user" | "time_up" | "prolonged_face_absence" | "all_questions_answered" | "tab_switch_limit" | "face_not_detected_limit";
  proctoringIssues?: {
    tabSwitch: number;
    faceNotDetected: number; // For short absences, leading to strict warning
    task_inactivity: number; // Simple warning
    distraction: number; // Simple warning
  };
}

export interface GeneratedQuestion {
  id: string;
  text: string;
  stage: "oral" | "technical_written";
  type: "behavioral" | "technical" | "coding" | "conversational" | "resume_based";
  answer?: string; 
}

export interface DetailedQuestionFeedbackItem {
  questionId: string; 
  questionText: string;
  userAnswer?: string;
  idealAnswer: string;
  refinementSuggestions: string;
  score: number; 
}

export interface InterviewFeedback {
  overallScore?: number; 
  overallFeedback: string;
  strengthsSummary: string; 
  weaknessesSummary: string; 
  overallAreasForImprovement: string; 
  detailedQuestionFeedback?: DetailedQuestionFeedbackItem[]; 
}
