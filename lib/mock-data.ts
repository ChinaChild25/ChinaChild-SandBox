import type { User, Course, Lesson, Notification, Achievement, LearningResource } from "./types"

export const mockUser: User = {
  id: "user-1",
  email: "student@example.com",
  name: "Alex Chen",
  avatar: undefined,
  level: "Intermediate",
  joinDate: "2025-09-15",
  learningStreak: 12,
  totalLessonsCompleted: 47,
  totalStudyHours: 126
}

export const mockCourses: Course[] = [
  {
    id: "course-1",
    title: "Mandarin Fundamentals",
    titleChinese: "汉语基础",
    description: "Master the basics of Mandarin Chinese including tones, pinyin, and essential vocabulary.",
    level: "Beginner",
    totalLessons: 24,
    completedLessons: 24,
    progress: 100,
    instructor: "Li Wei",
    thumbnail: "/courses/fundamentals.jpg",
    category: "Speaking",
    enrolled: true
  },
  {
    id: "course-2",
    title: "Business Chinese",
    titleChinese: "商务汉语",
    description: "Professional Chinese for business meetings, negotiations, and formal correspondence.",
    level: "Intermediate",
    totalLessons: 20,
    completedLessons: 12,
    progress: 60,
    instructor: "Zhang Ming",
    thumbnail: "/courses/business.jpg",
    category: "Speaking",
    enrolled: true
  },
  {
    id: "course-3",
    title: "Chinese Characters Mastery",
    titleChinese: "汉字精通",
    description: "Learn to read and write 500 essential Chinese characters with stroke order and etymology.",
    level: "Elementary",
    totalLessons: 30,
    completedLessons: 18,
    progress: 60,
    instructor: "Wang Fang",
    thumbnail: "/courses/characters.jpg",
    category: "Writing",
    enrolled: true
  },
  {
    id: "course-4",
    title: "Chinese Culture & Traditions",
    titleChinese: "中国文化与传统",
    description: "Explore Chinese festivals, customs, and cultural practices through language.",
    level: "Intermediate",
    totalLessons: 16,
    completedLessons: 4,
    progress: 25,
    instructor: "Chen Mei",
    thumbnail: "/courses/culture.jpg",
    category: "Culture",
    enrolled: true
  },
  {
    id: "course-5",
    title: "HSK 4 Preparation",
    titleChinese: "HSK四级备考",
    description: "Comprehensive preparation for the HSK Level 4 standardized test.",
    level: "Intermediate",
    totalLessons: 40,
    completedLessons: 0,
    progress: 0,
    instructor: "Liu Hua",
    thumbnail: "/courses/hsk.jpg",
    category: "Grammar",
    enrolled: false
  },
  {
    id: "course-6",
    title: "Advanced Reading Comprehension",
    titleChinese: "高级阅读理解",
    description: "Tackle complex texts including news articles, literature, and academic papers.",
    level: "Advanced",
    totalLessons: 25,
    completedLessons: 0,
    progress: 0,
    instructor: "Zhao Jing",
    thumbnail: "/courses/reading.jpg",
    category: "Reading",
    enrolled: false
  }
]

export const mockLessons: Lesson[] = [
  {
    id: "lesson-1",
    courseId: "course-2",
    title: "Business Meeting Vocabulary",
    titleChinese: "商务会议词汇",
    duration: "45 min",
    scheduledDate: "2026-04-10",
    scheduledTime: "10:00 AM",
    type: "Live",
    status: "upcoming"
  },
  {
    id: "lesson-2",
    courseId: "course-3",
    title: "Characters 201-220",
    titleChinese: "汉字201-220",
    duration: "30 min",
    scheduledDate: "2026-04-10",
    scheduledTime: "2:00 PM",
    type: "Video",
    status: "upcoming"
  },
  {
    id: "lesson-3",
    courseId: "course-4",
    title: "Spring Festival Traditions",
    titleChinese: "春节传统",
    duration: "40 min",
    scheduledDate: "2026-04-11",
    scheduledTime: "11:00 AM",
    type: "Video",
    status: "upcoming"
  },
  {
    id: "lesson-4",
    courseId: "course-2",
    title: "Email Etiquette in Chinese",
    titleChinese: "中文邮件礼仪",
    duration: "35 min",
    scheduledDate: "2026-04-12",
    scheduledTime: "9:30 AM",
    type: "Practice",
    status: "upcoming"
  },
  {
    id: "lesson-5",
    courseId: "course-3",
    title: "Weekly Quiz: Characters 181-200",
    titleChinese: "周测：汉字181-200",
    duration: "20 min",
    scheduledDate: "2026-04-13",
    scheduledTime: "3:00 PM",
    type: "Quiz",
    status: "upcoming"
  }
]

export const mockNotifications: Notification[] = [
  {
    id: "notif-1",
    title: "Live Lesson Starting Soon",
    message: "Your Business Meeting Vocabulary lesson starts in 1 hour.",
    type: "lesson",
    read: false,
    createdAt: "2026-04-10T09:00:00"
  },
  {
    id: "notif-2",
    title: "Achievement Unlocked!",
    message: "Congratulations! You've earned the 'Week Warrior' badge for 7-day streak.",
    type: "achievement",
    read: false,
    createdAt: "2026-04-09T18:00:00"
  },
  {
    id: "notif-3",
    title: "New Course Available",
    message: "Check out our new HSK 5 Preparation course launching next week.",
    type: "system",
    read: true,
    createdAt: "2026-04-08T10:00:00"
  },
  {
    id: "notif-4",
    title: "Practice Reminder",
    message: "You haven't practiced speaking today. Keep your streak alive!",
    type: "reminder",
    read: true,
    createdAt: "2026-04-07T20:00:00"
  }
]

export const mockAchievements: Achievement[] = [
  {
    id: "achieve-1",
    title: "First Steps",
    description: "Complete your first lesson",
    icon: "footprints",
    unlockedAt: "2025-09-16"
  },
  {
    id: "achieve-2",
    title: "Week Warrior",
    description: "Maintain a 7-day learning streak",
    icon: "flame",
    unlockedAt: "2025-09-22"
  },
  {
    id: "achieve-3",
    title: "Character Champion",
    description: "Learn 100 Chinese characters",
    icon: "pen-tool",
    unlockedAt: "2025-11-10"
  },
  {
    id: "achieve-4",
    title: "Tone Master",
    description: "Perfect score on tone quiz",
    icon: "music",
    unlockedAt: "2025-10-05"
  },
  {
    id: "achieve-5",
    title: "Century Club",
    description: "Study for 100+ hours",
    icon: "clock",
    unlockedAt: "2026-03-15"
  },
  {
    id: "achieve-6",
    title: "Polyglot Path",
    description: "Reach Advanced level",
    icon: "trophy",
    progress: 75
  }
]

export const mockResources: LearningResource[] = [
  {
    id: "resource-1",
    title: "Pinyin Reference Guide",
    titleChinese: "拼音参考指南",
    type: "PDF",
    category: "Pronunciation",
    downloadUrl: "/resources/pinyin-guide.pdf"
  },
  {
    id: "resource-2",
    title: "Tone Practice Audio",
    titleChinese: "声调练习音频",
    type: "Audio",
    category: "Pronunciation",
    downloadUrl: "/resources/tones.mp3"
  },
  {
    id: "resource-3",
    title: "HSK 4 Vocabulary Flashcards",
    titleChinese: "HSK四级词汇卡",
    type: "Flashcards",
    category: "Vocabulary",
    downloadUrl: "/resources/hsk4-vocab.json"
  },
  {
    id: "resource-4",
    title: "Stroke Order Animation",
    titleChinese: "笔画顺序动画",
    type: "Video",
    category: "Writing",
    downloadUrl: "/resources/strokes.mp4"
  },
  {
    id: "resource-5",
    title: "Common Radicals Chart",
    titleChinese: "常用部首表",
    type: "PDF",
    category: "Writing",
    downloadUrl: "/resources/radicals.pdf"
  },
  {
    id: "resource-6",
    title: "Business Phrases Audio",
    titleChinese: "商务短语音频",
    type: "Audio",
    category: "Business",
    downloadUrl: "/resources/business-audio.mp3"
  }
]
