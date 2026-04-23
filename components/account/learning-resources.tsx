"use client"

import { FileText, Headphones, Video, Layers, Download, ExternalLink } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { mockResources } from "@/lib/mock-data"

export function LearningResources() {
  const typeConfig = {
    PDF: { icon: FileText },
    Audio: { icon: Headphones },
    Video: { icon: Video },
    Flashcards: { icon: Layers }
  }

  const groupedResources = mockResources.reduce(
    (acc, resource) => {
      if (!acc[resource.category]) {
        acc[resource.category] = []
      }
      acc[resource.category].push(resource)
      return acc
    },
    {} as Record<string, typeof mockResources>
  )

  return (
    <Card className="border-0 bg-muted/30 shadow-none">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Learning Resources</CardTitle>
        <CardDescription>
          Downloadable materials and study aids for your courses
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {Object.entries(groupedResources).map(([category, resources]) => (
            <div key={category}>
              <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {category}
              </h3>
              <div className="space-y-2">
                {resources.map((resource) => {
                  const config = typeConfig[resource.type]
                  const Icon = config.icon

                  return (
                    <div
                      key={resource.id}
                      className="flex items-center gap-4 p-3 rounded-xl bg-background border border-border hover:border-muted-foreground/20 transition-colors"
                    >
                      <div className="h-10 w-10 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">
                          {resource.title}
                        </h4>
                        <p className="text-xs text-muted-foreground truncate">
                          {resource.titleChinese}
                        </p>
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted shrink-0">
                        {resource.type}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="shrink-0 rounded-lg hover:bg-foreground hover:text-background"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Links */}
        <div className="mt-6 pt-6 border-t border-border">
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            External Resources
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href="#"
              className="flex items-center gap-3 p-3 rounded-xl bg-background border border-border hover:border-muted-foreground/20 transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <ExternalLink className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">Chinese Dictionary</p>
                <p className="text-xs text-muted-foreground">
                  MDBG Online Dictionary
                </p>
              </div>
            </a>
            <a
              href="#"
              className="flex items-center gap-3 p-3 rounded-xl bg-background border border-border hover:border-muted-foreground/20 transition-colors"
            >
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <ExternalLink className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">Character Writing</p>
                <p className="text-xs text-muted-foreground">
                  Stroke Order Practice
                </p>
              </div>
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
