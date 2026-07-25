"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { THEME_MODES, type ThemeMode } from "@/lib/theme";
import { useTheme } from "./ThemeProvider";

const MODE_LABELS: Record<ThemeMode, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

const MODE_ICONS: Record<ThemeMode, React.ComponentType<{ className?: string }>> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

/** Compact theme picker for the top bar. */
export function ThemeToggle() {
  const { mode, theme, setMode } = useTheme();
  const TriggerIcon = mode === "system" ? MODE_ICONS[theme] : MODE_ICONS[mode];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          title={`Theme: ${MODE_LABELS[mode]}`}
          aria-label={`Theme: ${MODE_LABELS[mode]}`}
        >
          <TriggerIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {THEME_MODES.map((option) => {
          const Icon = MODE_ICONS[option];
          return (
            <DropdownMenuItem
              key={option}
              onSelect={() => setMode(option)}
              className={cn("gap-2", mode === option && "text-accent")}
            >
              <Icon className="h-4 w-4" />
              {MODE_LABELS[option]}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Full-width segmented control, used on the settings page. */
export function ThemeModeSelector() {
  const { mode, setMode } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center gap-1 rounded-lg bg-raise p-1"
    >
      {THEME_MODES.map((option) => {
        const Icon = MODE_ICONS[option];
        const active = mode === option;
        return (
          <button
            key={option}
            role="radio"
            aria-checked={active}
            onClick={() => setMode(option)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              active
                ? "bg-surface dark:bg-raise-strong text-foreground shadow-sm"
                : "text-fg-muted hover:text-foreground hover:bg-hover"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {MODE_LABELS[option]}
          </button>
        );
      })}
    </div>
  );
}
