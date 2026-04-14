import type { DatasetTag } from "@/lib/api-types";
import { getDatasetTagStyle } from "@/lib/dataset-tags";
import { cn } from "@/lib/utils";

type DatasetTagListProps = {
  tags: DatasetTag[];
  className?: string;
};

export function DatasetTagList({ tags, className }: DatasetTagListProps) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center rounded-full border px-2.5 py-1 text-[0.72rem] font-medium leading-none"
          style={getDatasetTagStyle(tag.color)}
        >
          {tag.label}
        </span>
      ))}
    </div>
  );
}
