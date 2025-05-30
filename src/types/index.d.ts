
export interface EducationItem {
  id: string; // Unique ID for the item
  degree: string;
  institution: string;
  yearOfCompletion: string;
  details?: string;
}

export interface ExperienceItem {
  id: string; // Unique ID for the item
  jobTitle: string;
  companyName: string;
  startDate: string;
  endDate: string; // Could be 'Present'
  description?: string;
}

export interface ProjectItem {
  id: string; // Unique ID for the item
  title: string;
  description: string;
  technologiesUsed?: string[];
  projectUrl?: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  name?: string | null; // Made nullable for consistency
  profileField: string; // Mandatory
  role: string; // Mandatory
  company?: string | null;
  phoneNumber?: string | null;
  
  keySkills?: string[];
  experiences?: ExperienceItem[];
  projects?: ProjectItem[];
  educationHistory?: EducationItem[];
  accomplishments?: string | null;

  resumeFileName?: string | null; 
  resumeFileUrl?: string | null; 
  resumeStoragePath?: string | null; 
  resumeProcessedText?: string | null; 

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
    faceNotDetected_short: number; // For short absences, simple warning
    task_inactivity: number; 
    distraction: number; 
    // faceNotDetected is now faceNotDetected_short for simple warnings
  };
}

// Schema for a single generated question, used as part of the input to this flow.
// This needs to match the structure of questions stored in the InterviewSession document.
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
