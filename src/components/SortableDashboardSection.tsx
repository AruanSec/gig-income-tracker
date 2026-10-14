import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

interface SortableDashboardSectionProps {
  id: string;
  key?: React.Key;
  children: React.ReactNode;
  headerLabel?: string;
  className?: string;
}

export function SortableDashboardSection({
  id,
  children,
  headerLabel,
  className = "",
}: SortableDashboardSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : "auto",
    position: "relative",
    opacity: isDragging ? 0.75 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/sortable relative transition-shadow ${
        isDragging
          ? "ring-2 ring-blue-500 shadow-2xl rounded-2xl bg-white dark:bg-slate-900"
          : ""
      } ${className}`}
    >
      {/* Drag handle button overlay */}
      <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity">
        <button
          {...attributes}
          {...listeners}
          type="button"
          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-grab active:cursor-grabbing border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-1 text-[10px] font-bold select-none transition-colors"
          title={`Drag to reorder section: ${headerLabel || id}`}
          aria-label={`Drag to reorder ${headerLabel || id}`}
        >
          <GripVertical className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          <span className="hidden group-hover/sortable:inline font-mono text-[9px] uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Reorder
          </span>
        </button>
      </div>

      {children}
    </div>
  );
}
