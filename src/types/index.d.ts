
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
  endDate: string; 
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
  name?: string | null; 
  profileField: string; 
  role: string; 
  company?: string | null;
  phoneNumber?: string | null;
  
  keySkills?: string[];
  experiences?: ExperienceItem[];
  projects?: ProjectItem[];
  educationHistory?: EducationItem[];
  accomplishments?: string | null;

  targetJobDescription?: string | null; // General target JD in profile

  // Resume fields are for Firebase Storage if used, or just processed text
  resumeFileName?: string | null; 
  resumeFileUrl?: string | null; 
  resumeStoragePath?: string | null; 
  resumeProcessedText?: string | null; // Client-side extracted text for AI

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
  duration: 15 | 30 | 45; 
  status: "pending" | "questions_generated" | "started" | "completed" | "cancelled";
  questions?: GeneratedQuestion[]; 
  transcript?: string; 
  feedback?: InterviewFeedback;
  createdAt: string;
  updatedAt?: string;
  endedReason?: "completed_by_user" | "time_up" | "prolonged_face_absence" | "all_questions_answered" | "tab_switch_limit" | "face_not_detected_limit";
  proctoringIssues?: {
    tabSwitch: number;
    faceNotDetected: number; 
    task_inactivity: number; 
    distraction: number; 
  };
  jobDescriptionUsed?: string; // Store the JD used for this specific session
}

export interface GeneratedQuestion {
  id: string;
  text: string;
  stage: "oral" | "technical_written";
  type: "behavioral" | "technical" | "coding" | "conversational" | "resume_based" | "jd_based";
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
