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

  resumeRawText?: string | null;
  resumeRawTextProvidedAndNotEmpty?: boolean;
  resumeFileName?: string | null;

  createdAt: string;
  interviewsTaken?: number;
  isPlusSubscriber?: boolean;
  subscriptionPlan?: "monthly" | "quarterly" | "yearly" | null;
  isAdmin?: boolean;
  updatedAt?: string;
  roles?: Role[];
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
  status:
    | "pending"
    | "questions_generated"
    | "started"
    | "completed"
    | "cancelled";
  questions?: GeneratedQuestion[];
  transcript?: string;
  feedback?: InterviewFeedback;
  createdAt: string;
  updatedAt?: string;
  endedReason?:
    | "completed_by_user"
    | "time_up"
    | "prolonged_face_absence"
    | "all_questions_answered"
    | "tab_switch_limit"
    | "face_not_detected_limit";
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
  type:
    | "behavioral"
    | "technical"
    | "coding"
    | "conversational"
    | "resume_based"
    | "jd_based"
    | "profile_based"
    | "structured_exp_based"
    | "structured_proj_based";
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

// Role-based Access Control Types
export type Role =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "CEO"
  | "CTO"
  | "CBO"
  | "CMO"
  | "CFO"
  | "MANAGER"
  | "HR"
  | "NO_ROLE";

export type Permission =
  | "VIEW_ADMIN_DASHBOARD"
  | "MANAGE_USERS"
  | "MANAGE_ROLES"
  | "VIEW_ANALYTICS"
  | "VIEW_FINANCIALS"
  | "UPLOAD_STUDY_MATERIALS"
  | "EDIT_STUDY_MATERIALS"
  | "DELETE_STUDY_MATERIALS"
  | "APPROVE_STUDY_MATERIALS"
  | "MANAGE_CONTENT"
  | "VIEW_USER_QUERY"
  | "SYSTEM_SETTINGS";

// Study Material Types
export interface StudyMaterial {
  id: string;
  title: string;
  description: string;
  type: "article" | "video" | "course" | "quiz" | "podcast" | "code";
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  duration: string;
  tags: string[];
  author: string;
  authorUid: string;
  authorRole?: Role;
  views: number;
  viewedBy?: string[];
  rating: number;
  isBookmarked: boolean;
  approved: boolean;
  createdAt: string;
  updatedAt: string;
  fileUrl?: string;
  thumbnail: string;
  content?: string;
  progress?: number;
  isPremium?: boolean;
  userRatings?: Record<string, number>;

  // Article
  transcript?: string;

  // Video
  videoUrl?: string;

  // Podcast
  hostName?: string;
  episodeNumber?: number;

  // Course
  modules?: {
    id: string;
    title: string;
    description: string;
    duration: string;
  }[];

  prerequisites?: string[];
  learningOutcomes?: string[];

  // Quiz
  questions?: {
    id: string;
    question: string;
    options: string[];
    correctAnswer: number;
    explanation?: string;
  }[];
  timeLimit?: number;
  passingScore?: number;

  // Code
  programmingLanguage?: string;
  githubUrl?: string;
  liveDemo?: string;
  codeContent?: string;
  documentation?: string;

  // Extra
  estimatedHours?: number;
  externalUrl?: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Filter and Search Types
export interface UserFilters {
  name?: string;
  email?: string;
  role?: Role | "all";
  plan?: "all" | "free" | "monthly" | "quarterly" | "yearly" | "plus_unknown";
  isAdmin?: "all" | "yes" | "no";
  dateRange?: {
    from?: Date;
    to?: Date;
  };
}

export interface MaterialFilters {
  title?: string;
  type?: StudyMaterial["type"] | "all";
  category?: string;
  difficulty?: StudyMaterial["difficulty"] | "all";
  approved?: "all" | "approved" | "pending";
  author?: string;
  tags?: string[];
}

// Component Props Types
export interface PermissionGuardProps {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export interface RoleBadgeProps {
  role: Role;
  className?: string;
}

// Context Types
export interface AuthContextType {
  user: any; // Firebase User
  userProfile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  initialLoading: boolean;
  signOut: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  updateUserRoles: (uid: string, roles: Role[]) => Promise<void>;
  hasRole: (role: Role) => boolean;
  hasPermission: (permission: Permission) => boolean;
}
