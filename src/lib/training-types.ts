import { UserRole } from "./types";

// Course categories for organization
export type CourseCategory = "onboarding" | "skills" | "advanced" | "compliance";

// Course status
export type CourseStatus = "draft" | "published";

// Lesson content types
export type LessonType = "video" | "article" | "quiz" | "faq";

// Progress status for lessons
export type ProgressStatus = "not_started" | "in_progress" | "completed";

// Quiz question types
export type QuizQuestionType = "multiple_choice" | "true_false" | "multi_select" | "short_answer";

// Course - main training course
export interface Course {
  id: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  category: CourseCategory;
  isRequired: boolean;           // Required for all hosts
  isSequential: boolean;         // Must complete in order
  requiredRoles: UserRole[];     // Who can access
  estimatedDuration: number;     // Total minutes
  order: number;                 // Display order
  status: CourseStatus;
  createdAt: string;
  updatedAt: string;
}

// Section - groups lessons within a course
export interface Section {
  id: string;
  courseId: string;              // FK to Course
  title: string;
  description?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

// Lesson - individual learning unit
export interface Lesson {
  id: string;
  sectionId: string;             // FK to Section
  courseId: string;              // FK to Course (denormalized for queries)
  title: string;
  type: LessonType;
  content: string;               // HTML/Markdown for articles
  videoUrl?: string;             // YouTube/Vimeo embed URL
  videoS3Key?: string;           // S3 key for uploaded videos
  estimatedDuration: number;     // Minutes
  order: number;
  createdAt: string;
  updatedAt: string;
}

// Quiz question
export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  question: string;
  options?: string[];            // For choice questions
  correctAnswers: string[];      // Can be multiple for multi_select
  explanation?: string;          // Show after answering
  points: number;
}

// Quiz - attached to a lesson
export interface Quiz {
  id: string;
  lessonId: string;              // FK to Lesson
  title: string;
  passingScore: number;          // 0-100
  maxAttempts: number;           // 0 = unlimited
  questions: QuizQuestion[];
  createdAt: string;
  updatedAt: string;
}

// FAQ - frequently asked questions
export interface FAQ {
  id: string;
  lessonId?: string;             // Optional link to lesson
  category: string;
  question: string;
  answer: string;                // HTML/Markdown
  order: number;
  createdAt: string;
  updatedAt: string;
}

// Training progress - tracks user progress through lessons
export interface TrainingProgress {
  id: string;                    // `${userId}#${lessonId}`
  oduserId: string;
  courseId: string;
  sectionId: string;
  lessonId: string;
  status: ProgressStatus;
  startedAt?: string;
  completedAt?: string;
  timeSpent: number;             // Seconds
  updatedAt: string;
}

// Quiz attempt - records a user's attempt at a quiz
export interface QuizAttempt {
  id: string;
  oduserId: string;
  quizId: string;
  lessonId: string;
  answers: Record<string, string[]>;  // questionId -> selected answers
  score: number;
  passed: boolean;
  attemptNumber: number;
  completedAt: string;
}

// Extended types for API responses

// Course with sections and lessons included
export interface CourseWithContent extends Course {
  sections: SectionWithLessons[];
}

// Section with lessons included
export interface SectionWithLessons extends Section {
  lessons: Lesson[];
}

// Lesson with quiz included (if type is quiz)
export interface LessonWithQuiz extends Lesson {
  quiz?: Quiz;
}

// Course progress summary for a user
export interface CourseProgressSummary {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  inProgressLessons: number;
  percentComplete: number;
  totalTimeSpent: number;        // Seconds
  isCompleted: boolean;
  lastAccessedAt?: string;
}

// User's overall training progress
export interface UserTrainingProgress {
  userId: string;
  courses: CourseProgressSummary[];
  totalCoursesCompleted: number;
  totalCoursesInProgress: number;
  overallPercentComplete: number;
}

// Category display configuration
export const CATEGORY_CONFIG: Record<CourseCategory, { label: string; color: string; icon: string }> = {
  onboarding: { label: "Onboarding", color: "bg-blue-100 text-blue-800", icon: "rocket" },
  skills: { label: "Skills", color: "bg-green-100 text-green-800", icon: "lightbulb" },
  advanced: { label: "Advanced", color: "bg-purple-100 text-purple-800", icon: "star" },
  compliance: { label: "Compliance", color: "bg-red-100 text-red-800", icon: "shield" },
};

// Lesson type display configuration
export const LESSON_TYPE_CONFIG: Record<LessonType, { label: string; icon: string }> = {
  video: { label: "Video", icon: "play" },
  article: { label: "Article", icon: "document" },
  quiz: { label: "Quiz", icon: "clipboard" },
  faq: { label: "FAQ", icon: "question" },
};

// Progress status display configuration
export const PROGRESS_STATUS_CONFIG: Record<ProgressStatus, { label: string; color: string }> = {
  not_started: { label: "Not Started", color: "text-gray-400" },
  in_progress: { label: "In Progress", color: "text-yellow-600" },
  completed: { label: "Completed", color: "text-green-600" },
};
