import type { DatasetTag } from "@/lib/api-types";
import { getDatasetTagStyle } from "@/lib/dataset-tags";
import { BadgeTagList } from "@/components/dashboard/badge-tag-list";

type DatasetTagListProps = {
  tags: DatasetTag[];
  className?: string;
};

export function DatasetTagList({ tags, className }: DatasetTagListProps) {
  return (
    <BadgeTagList
      items={tags.map((tag) => ({
        id: tag.id,
        label: tag.label,
        style: getDatasetTagStyle(tag.color),
        className:
          "text-[var(--dataset-tag-text-light)] dark:text-[var(--dataset-tag-text-dark)]",
      }))}
      className={className}
    />
  );
}
