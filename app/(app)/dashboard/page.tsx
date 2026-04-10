"use client"

import Image from "next/image"
import {
  ArrowRight,
  ChevronRight
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { mockLessons } from "@/lib/mock-data"
import { placeholderImages } from "@/lib/placeholders"

const lessonDots: Record<number, string[]> = {
  1: ["bg-black/40", "bg-black/20"],
  4: ["bg-black/20"],
  5: ["bg-[#d8e998]"],
  11: ["bg-black/70"],
  12: ["bg-[#f2aba3]"],
  13: ["bg-[#d9eb97]"],
  15: ["bg-[#d9eb97]", "bg-black/80"],
  17: ["bg-[#d9eb97]", "bg-black/80"],
  19: ["bg-[#f2aba3]"],
  20: ["bg-[#d9eb97]"],
  22: ["bg-[#d9eb97]", "bg-black/80"],
  24: ["bg-[#d9eb97]", "bg-black/80"],
  25: ["bg-black/80"],
  26: ["bg-[#f2aba3]"],
  27: ["bg-[#d9eb97]"],
  29: ["bg-[#d9eb97]", "bg-black/80"],
  30: ["bg-black/80"]
}

const monthRows: Array<Array<number | null>> = [
  [null, 1, 2, 3, 4, 5, 6],
  [7, 8, 9, 10, 11, 12, 13],
  [14, 15, 16, 17, 18, 19, 20],
  [21, 22, 23, 24, 25, 26, 27],
  [28, 29, 30, null, null, null, null]
]

const mentors = [
  {
    name: "Ли Мэй",
    role: "куратор группы",
    image: placeholderImages.curatorAvatar
  },
  {
    name: "Ван Цзюнь",
    role: "преподаватель",
    image: placeholderImages.teacherAvatar
  }
]

const lessonColors = ["#10131d", "#d8d8d8", "#f1a9a2", "#d8d8d8", "#d8e998"]

export default function DashboardPage() {
  const { user } = useAuth()
  const dashboardStats = user?.dashboardStats ?? {
    attendedLessons: 9,
    lessonGoal: 48,
    completedHomework: 8,
    homeworkGoal: 48,
    averageScore: 93
  }
  const upcomingLessons = mockLessons.slice(0, 5)
  const lessonDays = [11, 11, 12, 12, 13]

  return (
    <div className="px-4 py-4 md:px-5 md:py-5 lg:px-6 lg:py-6">
      <div className="mx-auto flex w-full max-w-[76.5rem] flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-3">
          <section className="ek-surface rounded-[1.3rem] bg-[#dddddd] px-8 py-7">
            <p className="text-[4rem] leading-[0.88] font-medium tracking-[-0.05em] text-[#12141d]">
              {dashboardStats.attendedLessons}
              <span className="pl-1 text-[3rem] text-black/75">/{dashboardStats.lessonGoal}</span>
            </p>
            <p className="mt-5 text-[2.05rem] leading-[1.05] text-black/70">Посещено занятий</p>
          </section>
          <section className="ek-surface rounded-[1.3rem] bg-[#13151f] px-8 py-7 text-white">
            <p className="text-[4rem] leading-[0.88] font-medium tracking-[-0.05em]">
              {dashboardStats.completedHomework}
              <span className="pl-1 text-[3rem] text-white/80">/{dashboardStats.homeworkGoal}</span>
            </p>
            <p className="mt-5 text-[2.05rem] leading-[1.05] text-white/75">Выполнено ДЗ</p>
          </section>
          <section className="ek-surface rounded-[1.3rem] bg-[#d8ea95] px-8 py-7">
            <p className="text-[4rem] leading-[0.88] font-medium tracking-[-0.05em] text-[#12141d]">
              {dashboardStats.averageScore}
              <span className="pl-1 text-[3rem] text-black/75">/100</span>
            </p>
            <p className="mt-5 text-[2.05rem] leading-[1.05] text-black/70">
              Средний балл
              <br />
              по тестам
            </p>
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.04fr_0.96fr]">
          <section className="ek-surface rounded-[1.3rem] bg-[#ebebeb] px-5 py-4 sm:px-6">
            <ul className="divide-y divide-black/7">
              {upcomingLessons.map((lesson, index) => {
                const dayNumber = lessonDays[index] ?? Number(new Date(lesson.scheduledDate).getDate())
                const color = lessonColors[index] ?? "#d8d8d8"
                const circleText = color === "#10131d" ? "text-white" : "text-black/75"

                return (
                  <li key={lesson.id} className="flex items-center gap-4 py-3.5 first:pt-1">
                    <div
                      className={`flex h-[4.45rem] w-[4.45rem] shrink-0 flex-col items-center justify-center rounded-full ${circleText}`}
                      style={{ backgroundColor: color }}
                    >
                      <span className="text-[1.95rem] leading-none tracking-[-0.03em]">{dayNumber}</span>
                      <span className="mt-1 text-[0.7rem] leading-none">
                        {lesson.duration}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[2.85rem] leading-[0.9] tracking-[-0.05em] text-[#1a1d26]">
                        {lesson.title}
                      </p>
                      <p className="mt-1 text-[1.02rem] leading-[1.2] text-black/58">
                        {lesson.titleChinese}
                      </p>
                    </div>
                    <ChevronRight className="h-8 w-8 shrink-0 text-black/48" />
                  </li>
                )
              })}
            </ul>
            <button className="mt-2 ml-[6.1rem] text-[2rem] tracking-[-0.04em] text-[#b4cb62] transition-opacity hover:opacity-80">
              смотреть далее
            </button>
          </section>

          <div className="grid gap-4">
            <section className="ek-surface rounded-[1.3rem] bg-[#ebebeb] px-6 py-5">
              <div className="flex items-end justify-between">
                <h2 className="text-[2.7rem] leading-none font-semibold tracking-[-0.05em] text-[#141720]">
                  апрель <span className="text-[2rem] font-medium text-black/80">2025</span>
                </h2>
              </div>
              <div className="mt-4 grid grid-cols-7 gap-y-2 text-center">
                {["вс", "пн", "вт", "ср", "чт", "пт", "сб"].map((day) => (
                  <div
                    key={day}
                    className="text-[1.45rem] font-medium lowercase tracking-[-0.02em] text-black/86"
                  >
                    {day}
                  </div>
                ))}
                {monthRows.flat().map((day, index) => (
                  <div key={`${day ?? "x"}-${index}`} className="relative h-[3.3rem]">
                    {day ? (
                      <div className="flex h-full flex-col items-center justify-center">
                        <span
                          className={`grid h-7 w-7 place-content-center rounded-full text-[1.55rem] leading-none ${
                            day === 11 ? "bg-[#d8ea95] text-[#1a1d25]" : "text-black/76"
                          }`}
                        >
                          {day}
                        </span>
                        <div className="mt-[3px] flex h-[6px] items-center gap-[3px]">
                          {(lessonDots[day] ?? []).map((dotClass, dotIndex) => (
                            <span
                              key={`${day}-${dotIndex}`}
                              className={`h-[6px] w-[6px] rounded-full ${dotClass}`}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            <section className="ek-surface rounded-[1.3rem] bg-[#ebebeb] px-6 py-4">
              <ul className="divide-y divide-black/8">
                {mentors.map((mentor) => (
                  <li key={mentor.name} className="flex items-center gap-4 py-3">
                    <div className="h-[3.5rem] w-[3.5rem] shrink-0 overflow-hidden rounded-full bg-white">
                      <Image
                        src={mentor.image}
                        alt={mentor.name}
                        width={56}
                        height={56}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[2.2rem] leading-none tracking-[-0.04em] text-[#1a1d26]">
                        {mentor.name}
                      </p>
                      <p className="mt-1 text-[1.15rem] text-black/58">{mentor.role}</p>
                    </div>
                    <ArrowRight className="h-7 w-7 shrink-0 text-black" />
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
