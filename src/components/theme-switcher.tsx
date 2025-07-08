
"use client";

import { useTheme } from "next-themes"
import { Sun, Moon, Laptop, CheckCircle2 } from "lucide-react"
import { Button } from "./ui/button"

interface ThemeSwitcherProps {
    variant?: "theme" | "color",
    colors?: { name: string, value: string }[],
    onColorChange?: (colorValue: string) => void,
    currentColor?: string,
}

export function ThemeSwitcher({ variant = "theme", colors, onColorChange, currentColor }: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme()

  if(variant === "color" && colors && onColorChange) {
    return (
        <div className="flex flex-wrap gap-3">
            {colors.map((color) => (
                <button 
                    key={color.name} 
                    title={color.name} 
                    onClick={() => onColorChange(color.value)} 
                    className="h-10 w-10 rounded-full border-2 transition-all flex items-center justify-center" 
                    style={{ backgroundColor: `hsl(${color.value})`, borderColor: currentColor === color.value ? `hsl(${color.value})` : 'transparent' }}
                >
                    {currentColor === color.value && <CheckCircle2 className="size-6 text-white" />}
                </button>
            ))}
        </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Button variant={theme === 'light' ? 'default' : 'outline'} onClick={() => setTheme('light')}><Sun className="mr-2"/> Light</Button>
      <Button variant={theme === 'dark' ? 'default' : 'outline'} onClick={() => setTheme('dark')}><Moon className="mr-2"/> Dark</Button>
      <Button variant={theme === 'system' ? 'default' : 'outline'} onClick={() => setTheme('system')}><Laptop className="mr-2"/> System</Button>
    </div>
  )
}
