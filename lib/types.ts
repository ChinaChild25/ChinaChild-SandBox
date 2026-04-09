export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  level: "Beginner" | "Elementary" | "Intermediate" | "Advanced"
  joinDate: string
  learningStreak: number
  totalLessonsCompleted: number
  totalStudyHours: number
}

export interface Course {
  id: string
  title: string
  titleChinese: string
  description: string
  level: "Beginner" | "Elementary" | "Intermediate" | "Advanced"
  totalLessons: number
  completedLessons: number
  progress: number
  instructor: string
  thumbnail: string
  category: "Speaking" | "Reading" | "Writing" | "Grammar" | "Culture"
  enrolled: boolean
}

export interface Lesson {
  id: string
  courseId: string
  title: string
  titleChinese: string
  duration: string
  scheduledDate: string
  scheduledTime: string
  type: "Video" | "Live" | "Practice" | "Quiz"
  status: "upcoming" | "completed" | "missed"
}

export interface Notification {
  id: string
  title: string
  message: string
  type: "lesson" | "achievement" | "system" | "reminder"
  read: boolean
  createdAt: string
}

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  unlockedAt?: string
  progress?: number
}

export interface LearningResource {
  id: string
  title: string
  titleChinese: string
  type: "PDF" | "Audio" | "Video" | "Flashcards"
  category: string
  downloadUrl: string
}
