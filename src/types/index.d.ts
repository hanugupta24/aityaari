
export interface EducationItem {
  id: string; 
  degree: string;
  institution: string;
  yearOfCompletion: string; // Should be YYYY
  details?: string;
}

export interface ExperienceItem {
  id: string; 
  jobTitle: string;
  companyName: string;
  startDate: string; // YYYY-MM
  endDate?: string; // YYYY-MM, optional for current job
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
  profileField: string; // Mandatory
  role: string; // Mandatory
  company?: string | null;
  phoneNumber?: string | null;
  
  keySkills?: string[];
  experiences?: ExperienceItem[];
  projects?: ProjectItem[];
  educationHistory?: EducationItem[];
  accomplishments?: string | null;
  
  resumeRawText?: string | null; // Stores the raw text extracted from resume
  resumeFileName?: string | null; // Stores the name of the uploaded resume file

  createdAt: string;
  interviewsTaken?: number;
  isPlusSubscriber?: boolean;
  subscriptionPlan?: 'monthly' | 'quarterly' | 'yearly' | null;
  isAdmin?: boolean;
  updatedAt?: string;
}

// This type represents the comprehensive structured data
// that would have been expected from the (hypothetical) external Python resume processing service.
// It's kept for reference or if that approach is revisited.
export interface ExtractedResumeData {
  name?: string;
  email?: string;
  phoneNumber?: string;
  profileField?: string; // e.g., "Software Engineering"
  role?: string; // e.g., "Senior Frontend Developer"
  keySkills?: string[];
  experiences?: ExperienceItem[];
  projects?: ProjectItem[];
  educationHistory?: EducationItem[];
  accomplishments?: string; // A summary or concatenated list
  rawText?: string; // The full raw text extracted from the resume
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
    faceNotDetected_short: number; 
    task_inactivity: number; 
    distraction: number; 
  };
  jobDescriptionUsed?: string; 
}

export interface GeneratedQuestion {
  id: string;
  text: string;
  stage: "oral" | "technical_written";
  type: "behavioral" | "technical" | "coding" | "conversational" | "resume_based" | "jd_based" | "profile_based" | "structured_exp_based" | "structured_proj_based";
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
