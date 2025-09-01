"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ChevronDown, Search, Sparkles, Eye, Zap, ImageIcon, Brain, Filter, Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface Model {
  id: string
  name: string
  provider: string
  icon: React.ReactNode
  capabilities: string[]
  category: "favorites" | "others"
  isNew?: boolean
  isPro?: boolean
}

const models: Model[] = [
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "Google",
    icon: <Sparkles className="w-4 h-4" />,
    capabilities: ["vision", "reasoning"],
    category: "favorites",
  },
  {
    id: "gemini-2.5-flash-thinking",
    name: "Gemini 2.5 Flash (Thinking)",
    provider: "Google",
    icon: <Sparkles className="w-4 h-4" />,
    capabilities: ["vision", "thinking", "reasoning"],
    category: "favorites",
  },
  {
    id: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    provider: "Google",
    icon: <Sparkles className="w-4 h-4" />,
    capabilities: ["vision", "reasoning"],
    category: "favorites",
  },
  {
    id: "gemini-2.5-flash-image",
    name: "Gemini 2.5 Flash Image",
    provider: "Google",
    icon: <Sparkles className="w-4 h-4" />,
    capabilities: ["vision", "image"],
    category: "favorites",
    isNew: true,
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "Google",
    icon: <Sparkles className="w-4 h-4" />,
    capabilities: ["vision", "thinking", "reasoning"],
    category: "favorites",
    isPro: true,
  },
  {
    id: "gemini-imagen-4",
    name: "Gemini Imagen 4",
    provider: "Google",
    icon: <div className="w-4 h-4 rounded bg-green-500" />,
    capabilities: ["image"],
    category: "favorites",
    isPro: true,
  },
  {
    id: "gemini-imagen-4-ultra",
    name: "Gemini Imagen 4 Ultra",
    provider: "Google",
    icon: <div className="w-4 h-4 rounded bg-green-500" />,
    capabilities: ["image"],
    category: "favorites",
    isPro: true,
  },
  {
    id: "gpt-imagegen",
    name: "GPT ImageGen",
    provider: "OpenAI",
    icon: <div className="w-4 h-4 rounded bg-green-500" />,
    capabilities: ["vision", "image"],
    category: "favorites",
    isPro: true,
  },
  {
    id: "gpt-5",
    name: "GPT-5",
    provider: "OpenAI",
    icon: <div className="w-4 h-4 rounded bg-green-500" />,
    capabilities: ["vision"],
    category: "favorites",
  },
  {
    id: "claude-4-sonnet",
    name: "Claude 4 Sonnet",
    provider: "Anthropic",
    icon: <div className="w-4 h-4 bg-orange-500 rounded" style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }} />,
    capabilities: ["vision", "reasoning"],
    category: "favorites",
    isPro: true,
  },
  {
    id: "claude-4-sonnet-reasoning",
    name: "Claude 4 Sonnet (Reasoning)",
    provider: "Anthropic",
    icon: <div className="w-4 h-4 bg-orange-500 rounded" style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }} />,
    capabilities: ["vision", "thinking", "reasoning"],
    category: "favorites",
    isPro: true,
  },
  {
    id: "deepseek-v3.1-thinking",
    name: "DeepSeek v3.1 (Thinking)",
    provider: "DeepSeek",
    icon: <div className="w-4 h-4 rounded bg-blue-500" />,
    capabilities: ["thinking"],
    category: "favorites",
  },
  {
    id: "deepseek-r1-llama-distilled",
    name: "DeepSeek R1 (Llama Distilled)",
    provider: "DeepSeek",
    icon: <div className="w-4 h-4 rounded bg-blue-500" />,
    capabilities: ["thinking"],
    category: "favorites",
  },
  {
    id: "glm-4.9-thinking",
    name: "GLM 4.9 (Thinking)",
    provider: "Zhipu",
    icon: <div className="w-4 h-4 bg-purple-500" style={{ clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }} />,
    capabilities: ["thinking"],
    category: "favorites",
  },
]

const capabilityIcons = {
  vision: <Eye className="w-3 h-3" />,
  reasoning: <Zap className="w-3 h-3" />,
  thinking: <Brain className="w-3 h-3" />,
  image: <ImageIcon className="w-3 h-3" />,
}

interface ModelSelectorProps {
  selectedModel: string
  onModelSelect: (model: string) => void
}

export function ModelSelector({ selectedModel, onModelSelect }: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showAll, setShowAll] = useState(false)

  const filteredModels = models.filter(
    (model) =>
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.provider.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const favoritesModels = filteredModels.filter((model) => model.category === "favorites")
  const otherModels = filteredModels.filter((model) => model.category === "others")

  const displayedFavorites = showAll ? favoritesModels : favoritesModels.slice(0, 15)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="text-zinc-400 hover:text-zinc-300 justify-start h-auto px-3 py-2 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span className="font-medium">{selectedModel}</span>
          </div>
          <ChevronDown className="w-4 h-4 ml-auto" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[720px] p-0 bg-zinc-950 border-zinc-800 shadow-2xl rounded-xl"
        align="start"
        sideOffset={8}
      >
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500 rounded-lg"
            />
          </div>
        </div>

        <div className="max-h-[480px] overflow-y-auto">
          {searchQuery === "" && (
            <div className="px-4 pb-4">
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-4 h-4 text-zinc-400" />
                <span className="text-sm font-medium text-zinc-400">Favorites</span>
              </div>
              <div className="grid grid-cols-5 gap-3">
                {displayedFavorites.map((model) => (
                  <ModelCard
                    key={model.id}
                    model={model}
                    isSelected={selectedModel === model.name}
                    onSelect={() => {
                      onModelSelect(model.name)
                      setOpen(false)
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {searchQuery === "" && otherModels.length > 0 && (
            <div className="px-4 pb-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-4 h-4 rounded-full bg-zinc-600" />
                <span className="text-sm font-medium text-zinc-400">Others</span>
              </div>
              <div className="grid grid-cols-5 gap-3">
                {otherModels.map((model) => (
                  <ModelCard
                    key={model.id}
                    model={model}
                    isSelected={selectedModel === model.name}
                    onSelect={() => {
                      onModelSelect(model.name)
                      setOpen(false)
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {searchQuery !== "" && (
            <div className="px-4 pb-4">
              <div className="space-y-1">
                {filteredModels.map((model) => (
                  <div
                    key={model.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                      selectedModel === model.name ? "bg-zinc-800" : "hover:bg-zinc-900",
                    )}
                    onClick={() => {
                      onModelSelect(model.name)
                      setOpen(false)
                    }}
                  >
                    <div className="flex-shrink-0">{model.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{model.name}</span>
                        {model.isNew && (
                          <span className="text-xs bg-amber-500 text-black px-2 py-0.5 rounded-full font-medium">
                            NEW
                          </span>
                        )}
                        {model.isPro && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {model.capabilities.map((capability) => (
                        <div key={capability} className="text-zinc-400">
                          {capabilityIcons[capability as keyof typeof capabilityIcons]}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {searchQuery === "" && (
          <div className="p-4 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-300">
                <ChevronDown className="w-4 h-4 mr-2" />
                Favorites
                <div className="w-2 h-2 bg-red-500 rounded-full ml-2" />
              </Button>
              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-300">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ModelCard({
  model,
  isSelected,
  onSelect,
}: {
  model: Model
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <div
      className={cn(
        "p-3 rounded-lg cursor-pointer transition-colors relative",
        isSelected ? "bg-amber-500/10 border border-amber-500/20" : "bg-zinc-900 hover:bg-zinc-800",
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-shrink-0">{model.icon}</div>
        <div className="flex gap-1">
          {model.isNew && (
            <span className="text-xs bg-amber-500 text-black px-2 py-0.5 rounded-full font-medium">NEW</span>
          )}
          {model.isPro && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1" />}
        </div>
      </div>

      <div className="text-sm font-medium text-white mb-3 leading-tight">{model.name}</div>

      <div className="flex gap-1">
        {model.capabilities.map((capability) => (
          <div key={capability} className="text-zinc-400">
            {capabilityIcons[capability as keyof typeof capabilityIcons]}
          </div>
        ))}
      </div>
    </div>
  )
}
