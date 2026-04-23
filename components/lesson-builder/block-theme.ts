import type { LessonBlockType } from "@/lib/types"

export const blockTypeAccentClass: Record<LessonBlockType, string> = {
  text: "border-[#bfdcff] bg-[#e8f3ff] text-[#2e4d73] hover:bg-[#d9ebff] dark:border-[#35567b] dark:bg-[#1b2a3c] dark:text-[#d2e6ff] dark:hover:bg-[#22364d]",
  matching:
    "border-[#cdecc8] bg-[#eefbe9] text-[#2e5e37] hover:bg-[#e1f6da] dark:border-[#3c7046] dark:bg-[#1f3224] dark:text-[#d4f0d8] dark:hover:bg-[#28412f]",
  fill_gaps:
    "border-[#f8dfbe] bg-[#fff3e2] text-[#7a5632] hover:bg-[#ffe9cf] dark:border-[#7a5a34] dark:bg-[#372a1f] dark:text-[#ffe5c4] dark:hover:bg-[#463424]",
  quiz_single:
    "border-[#ead3ff] bg-[#f7edff] text-[#5f3a87] hover:bg-[#f0e0ff] dark:border-[#6a4a91] dark:bg-[#2f2142] dark:text-[#ecd8ff] dark:hover:bg-[#3a2952]",
  quiz_multi:
    "border-[#2d2d2d] bg-[#1f1f1f] text-white hover:bg-[#111111] dark:border-[#4a4a4a] dark:bg-[#f2f2f2] dark:text-[#111111] dark:hover:bg-white",
  sentence_builder:
    "border-[#d9ed3a] bg-[#e7f54d] text-[#1c1c1c] hover:bg-[#d9ed3a] dark:border-[#b9cf26] dark:bg-[#d9ed3a] dark:text-[#111111] dark:hover:bg-[#e7f54d]",
  flashcards:
    "border-[#d9ed3a] bg-[#e7f54d] text-[#1c1c1c] hover:bg-[#d9ed3a] dark:border-[#b9cf26] dark:bg-[#d9ed3a] dark:text-[#111111] dark:hover:bg-[#e7f54d]",
  homework:
    "border-[#ffc9ce] bg-[#ffdadd] text-[#6d3d46] hover:bg-[#ffcfd5] dark:border-[#945560] dark:bg-[#40252b] dark:text-[#ffe3e6] dark:hover:bg-[#513138]",
  image:
    "border-[#c4e8f0] bg-[#e8f7fc] text-[#2a5560] hover:bg-[#d6f0f8] dark:border-[#356a78] dark:bg-[#1a2e34] dark:text-[#c8ecf5] dark:hover:bg-[#243d45]",
  video:
    "border-[#ffd4c4] bg-[#fff0ea] text-[#6d3d2e] hover:bg-[#ffe4d8] dark:border-[#8a5c4a] dark:bg-[#34221c] dark:text-[#ffdccd] dark:hover:bg-[#452f26]",
  audio:
    "border-[#ffd2dd] bg-[#ffeaf0] text-[#7f3c4f] hover:bg-[#ffdbe6] dark:border-[#8a4b5e] dark:bg-[#3a2430] dark:text-[#ffd9e4] dark:hover:bg-[#472c3a]",
  pdf:
    "border-[#d8d8de] bg-[#f7f7f9] text-[#5a5a67] hover:bg-[#efeff4] dark:border-[#4c4c57] dark:bg-[#232329] dark:text-[#d8d8df] dark:hover:bg-[#2b2b33]",
  speaking:
    "border-[#ffc9ce] bg-[#ffdadd] text-[#6d3d46] hover:bg-[#ffcfd5] dark:border-[#945560] dark:bg-[#40252b] dark:text-[#ffe3e6] dark:hover:bg-[#513138]",
  note:
    "border-[#bde6e7] bg-[#eaf9f9] text-[#2b6064] hover:bg-[#d8f3f4] dark:border-[#3c7278] dark:bg-[#1d3134] dark:text-[#c8eff1] dark:hover:bg-[#284146]",
  link:
    "border-[#bfd0ff] bg-[#ecf1ff] text-[#304d8d] hover:bg-[#dee7ff] dark:border-[#4660a2] dark:bg-[#232d48] dark:text-[#d9e1ff] dark:hover:bg-[#2d3960]",
  divider:
    "border-[#d8d8de] bg-[#f7f7f9] text-[#5a5a67] hover:bg-[#efeff4] dark:border-[#4c4c57] dark:bg-[#232329] dark:text-[#d8d8df] dark:hover:bg-[#2b2b33]"
}

/** Same palette as `blockTypeAccentClass` without border utilities (for compact icon buttons). */
export const blockTypeAccentFillClass: Record<LessonBlockType, string> = {
  text: "bg-[#e8f3ff] text-[#2e4d73] hover:bg-[#d9ebff] dark:bg-[#1b2a3c] dark:text-[#d2e6ff] dark:hover:bg-[#22364d]",
  matching: "bg-[#eefbe9] text-[#2e5e37] hover:bg-[#e1f6da] dark:bg-[#1f3224] dark:text-[#d4f0d8] dark:hover:bg-[#28412f]",
  fill_gaps: "bg-[#fff3e2] text-[#7a5632] hover:bg-[#ffe9cf] dark:bg-[#372a1f] dark:text-[#ffe5c4] dark:hover:bg-[#463424]",
  quiz_single: "bg-[#f7edff] text-[#5f3a87] hover:bg-[#f0e0ff] dark:bg-[#2f2142] dark:text-[#ecd8ff] dark:hover:bg-[#3a2952]",
  quiz_multi: "bg-[#1f1f1f] text-white hover:bg-[#111111] dark:bg-[#f2f2f2] dark:text-[#111111] dark:hover:bg-white",
  sentence_builder: "bg-[#e7f54d] text-[#1c1c1c] hover:bg-[#d9ed3a] dark:bg-[#d9ed3a] dark:text-[#111111] dark:hover:bg-[#e7f54d]",
  flashcards: "bg-[#e7f54d] text-[#1c1c1c] hover:bg-[#d9ed3a] dark:bg-[#d9ed3a] dark:text-[#111111] dark:hover:bg-[#e7f54d]",
  homework: "bg-[#ffdadd] text-[#6d3d46] hover:bg-[#ffcfd5] dark:bg-[#40252b] dark:text-[#ffe3e6] dark:hover:bg-[#513138]",
  image: "bg-[#e8f7fc] text-[#2a5560] hover:bg-[#d6f0f8] dark:bg-[#1a2e34] dark:text-[#c8ecf5] dark:hover:bg-[#243d45]",
  video: "bg-[#fff0ea] text-[#6d3d2e] hover:bg-[#ffe4d8] dark:bg-[#34221c] dark:text-[#ffdccd] dark:hover:bg-[#452f26]",
  audio: "bg-[#ffeaf0] text-[#7f3c4f] hover:bg-[#ffdbe6] dark:bg-[#3a2430] dark:text-[#ffd9e4] dark:hover:bg-[#472c3a]",
  pdf: "bg-[#f7f7f9] text-[#5a5a67] hover:bg-[#efeff4] dark:bg-[#232329] dark:text-[#d8d8df] dark:hover:bg-[#2b2b33]",
  speaking: "bg-[#ffdadd] text-[#6d3d46] hover:bg-[#ffcfd5] dark:bg-[#40252b] dark:text-[#ffe3e6] dark:hover:bg-[#513138]",
  note: "bg-[#eaf9f9] text-[#2b6064] hover:bg-[#d8f3f4] dark:bg-[#1d3134] dark:text-[#c8eff1] dark:hover:bg-[#284146]",
  link: "bg-[#ecf1ff] text-[#304d8d] hover:bg-[#dee7ff] dark:bg-[#232d48] dark:text-[#d9e1ff] dark:hover:bg-[#2d3960]",
  divider: "bg-[#f7f7f9] text-[#5a5a67] hover:bg-[#efeff4] dark:bg-[#232329] dark:text-[#d8d8df] dark:hover:bg-[#2b2b33]"
}

export const blockTypeStudentTheme: Record<
  LessonBlockType,
  {
    panel: string
    soft: string
    active: string
    hover: string
    ring: string
    text: string
    accent: string
  }
> = {
  text: {
    panel: "border-[#bfdcff]/80 bg-[#e8f3ff]/70 dark:border-[#35567b]/80 dark:bg-[#1b2a3c]/60",
    soft: "border-[#bfdcff] bg-[#f4f9ff] text-[#2e4d73] dark:border-[#35567b] dark:bg-[#1b2a3c]/70 dark:text-[#d2e6ff]",
    active: "border-[#bfdcff] bg-[#e8f3ff] text-[#2e4d73] dark:border-[#35567b] dark:bg-[#1b2a3c] dark:text-[#d2e6ff]",
    hover: "hover:bg-[#d9ebff] dark:hover:bg-[#22364d]",
    ring: "ring-[#7fb2ea]/50 dark:ring-[#5f8fbe]/45",
    text: "text-[#2e4d73] dark:text-[#d2e6ff]",
    accent: "accent-[#2e4d73] dark:accent-[#d2e6ff]"
  },
  matching: {
    panel: "border-[#cdecc8]/80 bg-[#eefbe9]/70 dark:border-[#3c7046]/80 dark:bg-[#1f3224]/60",
    soft: "border-[#cdecc8] bg-[#f6fdf3] text-[#2e5e37] dark:border-[#3c7046] dark:bg-[#1f3224]/70 dark:text-[#d4f0d8]",
    active: "border-[#cdecc8] bg-[#eefbe9] text-[#2e5e37] dark:border-[#3c7046] dark:bg-[#1f3224] dark:text-[#d4f0d8]",
    hover: "hover:bg-[#e1f6da] dark:hover:bg-[#28412f]",
    ring: "ring-[#95cd8b]/50 dark:ring-[#5f9b67]/45",
    text: "text-[#2e5e37] dark:text-[#d4f0d8]",
    accent: "accent-[#2e5e37] dark:accent-[#d4f0d8]"
  },
  fill_gaps: {
    panel: "border-[#f8dfbe]/80 bg-[#fff3e2]/75 dark:border-[#7a5a34]/80 dark:bg-[#372a1f]/60",
    soft: "border-[#f8dfbe] bg-[#fff8ef] text-[#7a5632] dark:border-[#7a5a34] dark:bg-[#372a1f]/70 dark:text-[#ffe5c4]",
    active: "border-[#f8dfbe] bg-[#fff3e2] text-[#7a5632] dark:border-[#7a5a34] dark:bg-[#372a1f] dark:text-[#ffe5c4]",
    hover: "hover:bg-[#ffe9cf] dark:hover:bg-[#463424]",
    ring: "ring-[#e7b97a]/55 dark:ring-[#a67745]/45",
    text: "text-[#7a5632] dark:text-[#ffe5c4]",
    accent: "accent-[#7a5632] dark:accent-[#ffe5c4]"
  },
  quiz_single: {
    panel: "border-[#ead3ff]/80 bg-[#f7edff]/75 dark:border-[#6a4a91]/80 dark:bg-[#2f2142]/60",
    soft: "border-[#ead3ff] bg-[#fbf6ff] text-[#5f3a87] dark:border-[#6a4a91] dark:bg-[#2f2142]/70 dark:text-[#ecd8ff]",
    active: "border-[#ead3ff] bg-[#f7edff] text-[#5f3a87] dark:border-[#6a4a91] dark:bg-[#2f2142] dark:text-[#ecd8ff]",
    hover: "hover:bg-[#f0e0ff] dark:hover:bg-[#3a2952]",
    ring: "ring-[#c99df0]/55 dark:ring-[#8f69bf]/45",
    text: "text-[#5f3a87] dark:text-[#ecd8ff]",
    accent: "accent-[#5f3a87] dark:accent-[#ecd8ff]"
  },
  quiz_multi: {
    panel: "border-[#2d2d2d]/80 bg-[#1f1f1f]/92 dark:border-[#4a4a4a]/80 dark:bg-[#f2f2f2]/90",
    soft: "border-[#2d2d2d] bg-[#1f1f1f] text-white dark:border-[#4a4a4a] dark:bg-[#f2f2f2] dark:text-[#111111]",
    active: "border-[#2d2d2d] bg-[#1f1f1f] text-white dark:border-[#4a4a4a] dark:bg-[#f2f2f2] dark:text-[#111111]",
    hover: "hover:bg-[#111111] dark:hover:bg-white",
    ring: "ring-black/25 dark:ring-white/35",
    text: "text-[#111111] dark:text-[#111111]",
    accent: "accent-[#111111] dark:accent-[#111111]"
  },
  sentence_builder: {
    panel: "border-[#d9ed3a]/80 bg-[#eef8aa]/85 dark:border-[#b9cf26]/80 dark:bg-[#e7f54d]/85",
    soft: "border-[#d9ed3a] bg-[#f5fbd1] text-[#384108] dark:border-[#b9cf26] dark:bg-[#eef8aa] dark:text-[#1c1c1c]",
    active: "border-[#d9ed3a] bg-[#eef8aa] text-[#384108] dark:border-[#b9cf26] dark:bg-[#e7f54d] dark:text-[#1c1c1c]",
    hover: "hover:bg-[#e7f54d] dark:hover:bg-[#eef8aa]",
    ring: "ring-[#d9ed3a]/55 dark:ring-[#d9ed3a]/55",
    text: "text-[#384108] dark:text-[#1c1c1c]",
    accent: "accent-[#384108] dark:accent-[#1c1c1c]"
  },
  flashcards: {
    panel: "border-[#d9ed3a]/80 bg-[#eef8aa]/85 dark:border-[#b9cf26]/80 dark:bg-[#e7f54d]/85",
    soft: "border-[#d9ed3a] bg-[#f5fbd1] text-[#384108] dark:border-[#b9cf26] dark:bg-[#eef8aa] dark:text-[#1c1c1c]",
    active: "border-[#d9ed3a] bg-[#eef8aa] text-[#384108] dark:border-[#b9cf26] dark:bg-[#e7f54d] dark:text-[#1c1c1c]",
    hover: "hover:bg-[#e7f54d] dark:hover:bg-[#eef8aa]",
    ring: "ring-[#d9ed3a]/55 dark:ring-[#d9ed3a]/55",
    text: "text-[#384108] dark:text-[#1c1c1c]",
    accent: "accent-[#384108] dark:accent-[#1c1c1c]"
  },
  homework: {
    panel: "border-[#ffc9ce]/80 bg-[#fff0f2]/85 dark:border-[#945560]/80 dark:bg-[#40252b]/80",
    soft: "border-[#ffc9ce] bg-[#fff7f8] text-[#6d3d46] dark:border-[#945560] dark:bg-[#513138] dark:text-[#ffe3e6]",
    active: "border-[#ffc9ce] bg-[#fff0f2] text-[#6d3d46] dark:border-[#945560] dark:bg-[#40252b] dark:text-[#ffe3e6]",
    hover: "hover:bg-[#ffe6e9] dark:hover:bg-[#513138]",
    ring: "ring-[#ffb7c0]/55 dark:ring-[#d98595]/45",
    text: "text-[#6d3d46] dark:text-[#ffe3e6]",
    accent: "accent-[#6d3d46] dark:accent-[#ffe3e6]"
  },
  image: {
    panel: "border-[#c4e8f0]/80 bg-[#e8f7fc]/70 dark:border-[#356a78]/80 dark:bg-[#1a2e34]/60",
    soft: "border-[#c4e8f0] bg-[#f4fcfe] text-[#2a5560] dark:border-[#356a78] dark:bg-[#1a2e34]/70 dark:text-[#c8ecf5]",
    active: "border-[#c4e8f0] bg-[#e8f7fc] text-[#2a5560] dark:border-[#356a78] dark:bg-[#1a2e34] dark:text-[#c8ecf5]",
    hover: "hover:bg-[#d6f0f8] dark:hover:bg-[#243d45]",
    ring: "ring-[#7dc6d6]/50 dark:ring-[#4d8894]/45",
    text: "text-[#2a5560] dark:text-[#c8ecf5]",
    accent: "accent-[#2a5560] dark:accent-[#c8ecf5]"
  },
  video: {
    panel: "border-[#ffd4c4]/80 bg-[#fff0ea]/70 dark:border-[#8a5c4a]/80 dark:bg-[#34221c]/60",
    soft: "border-[#ffd4c4] bg-[#fff8f5] text-[#6d3d2e] dark:border-[#8a5c4a] dark:bg-[#34221c]/70 dark:text-[#ffdccd]",
    active: "border-[#ffd4c4] bg-[#fff0ea] text-[#6d3d2e] dark:border-[#8a5c4a] dark:bg-[#34221c] dark:text-[#ffdccd]",
    hover: "hover:bg-[#ffe4d8] dark:hover:bg-[#452f26]",
    ring: "ring-[#f0ab8f]/50 dark:ring-[#ab765e]/45",
    text: "text-[#6d3d2e] dark:text-[#ffdccd]",
    accent: "accent-[#6d3d2e] dark:accent-[#ffdccd]"
  },
  audio: {
    panel: "border-0 bg-[var(--ds-pink)] dark:border-0 dark:bg-[#3a2430]/60",
    soft: "border-[#ffd2dd] bg-[#fff6f8] text-[#7f3c4f] dark:border-[#8a4b5e] dark:bg-[#3a2430]/70 dark:text-[#ffd9e4]",
    active: "border-0 bg-[var(--background)] text-[#7e3c4f] dark:border-0 dark:bg-[#3a2430] dark:text-[#ffd9e4]",
    hover: "hover:bg-[#ffdbe6] dark:hover:bg-[#472c3a]",
    ring: "ring-[#eb9ab0]/50 dark:ring-[#a76579]/45",
    text: "text-[#7f3c4f] dark:text-[#ffd9e4]",
    accent: "accent-[#7f3c4f] dark:accent-[#ffd9e4]"
  },
  pdf: {
    panel: "border-[#d8d8de]/80 bg-[#f7f7f9]/80 dark:border-[#4c4c57]/80 dark:bg-[#232329]/70",
    soft: "border-[#d8d8de] bg-[#fcfcfd] text-[#5a5a67] dark:border-[#4c4c57] dark:bg-[#232329]/80 dark:text-[#d8d8df]",
    active: "border-[#d8d8de] bg-[#f7f7f9] text-[#5a5a67] dark:border-[#4c4c57] dark:bg-[#232329] dark:text-[#d8d8df]",
    hover: "hover:bg-[#efeff4] dark:hover:bg-[#2b2b33]",
    ring: "ring-[#b7b7c4]/45 dark:ring-[#6f6f80]/45",
    text: "text-[#5a5a67] dark:text-[#d8d8df]",
    accent: "accent-[#5a5a67] dark:accent-[#d8d8df]"
  },
  speaking: {
    panel: "border-[#ffc9ce]/80 bg-[#fff0f2]/85 dark:border-[#945560]/80 dark:bg-[#40252b]/80",
    soft: "border-[#ffc9ce] bg-[#fff7f8] text-[#6d3d46] dark:border-[#945560] dark:bg-[#513138] dark:text-[#ffe3e6]",
    active: "border-[#ffc9ce] bg-[#fff0f2] text-[#6d3d46] dark:border-[#945560] dark:bg-[#40252b] dark:text-[#ffe3e6]",
    hover: "hover:bg-[#ffe6e9] dark:hover:bg-[#513138]",
    ring: "ring-[#ffb7c0]/55 dark:ring-[#d98595]/45",
    text: "text-[#6d3d46] dark:text-[#ffe3e6]",
    accent: "accent-[#6d3d46] dark:accent-[#ffe3e6]"
  },
  note: {
    panel: "border-[#bde6e7]/80 bg-[#eaf9f9]/75 dark:border-[#3c7278]/80 dark:bg-[#1d3134]/60",
    soft: "border-[#bde6e7] bg-[#f3fbfb] text-[#2b6064] dark:border-[#3c7278] dark:bg-[#1d3134]/70 dark:text-[#c8eff1]",
    active: "border-[#bde6e7] bg-[#eaf9f9] text-[#2b6064] dark:border-[#3c7278] dark:bg-[#1d3134] dark:text-[#c8eff1]",
    hover: "hover:bg-[#d8f3f4] dark:hover:bg-[#284146]",
    ring: "ring-[#72c5ca]/50 dark:ring-[#4c8f94]/45",
    text: "text-[#2b6064] dark:text-[#c8eff1]",
    accent: "accent-[#2b6064] dark:accent-[#c8eff1]"
  },
  link: {
    panel: "border-[#bfd0ff]/80 bg-[#ecf1ff]/75 dark:border-[#4660a2]/80 dark:bg-[#232d48]/60",
    soft: "border-[#bfd0ff] bg-[#f4f7ff] text-[#304d8d] dark:border-[#4660a2] dark:bg-[#232d48]/70 dark:text-[#d9e1ff]",
    active: "border-[#bfd0ff] bg-[#ecf1ff] text-[#304d8d] dark:border-[#4660a2] dark:bg-[#232d48] dark:text-[#d9e1ff]",
    hover: "hover:bg-[#dee7ff] dark:hover:bg-[#2d3960]",
    ring: "ring-[#96acec]/50 dark:ring-[#6581c8]/45",
    text: "text-[#304d8d] dark:text-[#d9e1ff]",
    accent: "accent-[#304d8d] dark:accent-[#d9e1ff]"
  },
  divider: {
    panel: "border-[#d8d8de]/80 bg-[#f7f7f9]/80 dark:border-[#4c4c57]/80 dark:bg-[#232329]/70",
    soft: "border-[#d8d8de] bg-[#fcfcfd] text-[#5a5a67] dark:border-[#4c4c57] dark:bg-[#232329]/80 dark:text-[#d8d8df]",
    active: "border-[#d8d8de] bg-[#f7f7f9] text-[#5a5a67] dark:border-[#4c4c57] dark:bg-[#232329] dark:text-[#d8d8df]",
    hover: "hover:bg-[#efeff4] dark:hover:bg-[#2b2b33]",
    ring: "ring-[#b7b7c4]/45 dark:ring-[#6f6f80]/45",
    text: "text-[#5a5a67] dark:text-[#d8d8df]",
    accent: "accent-[#5a5a67] dark:accent-[#d8d8df]"
  }
}
