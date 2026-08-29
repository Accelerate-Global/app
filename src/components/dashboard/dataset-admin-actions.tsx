"use client";

import {
  ChevronDownIcon,
  FileOutputIcon,
  PencilIcon,
  Settings2Icon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DatasetPartnerExports } from "@/components/dashboard/dataset-partner-exports";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CsvColumn } from "@/lib/api-types";

type DatasetAdminActionsProps = {
  datasetId: string;
  partnerExportDatasetId: string;
  sourceColumns: CsvColumn[];
};

export function DatasetAdminActions({
  datasetId,
  partnerExportDatasetId,
  sourceColumns,
}: DatasetAdminActionsProps) {
  const [isPartnerExportsOpen, setIsPartnerExportsOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              data-smoke-trigger="dataset-actions-menu"
            />
          }
        >
          <Settings2Icon aria-hidden="true" className="size-4" />
          Dataset actions
          <ChevronDownIcon aria-hidden="true" className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="min-w-52"
          data-smoke-surface="dataset-actions-menu"
          data-smoke-ready="dataset-actions-menu"
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel>Dataset administration</DropdownMenuLabel>
            <DropdownMenuItem
              render={
                <Link
                  href={`/dashboard/datasets/${datasetId}/edit`}
                  data-smoke-dataset-edit-action
                  data-smoke-write="safe"
                />
              }
            >
              <PencilIcon aria-hidden="true" />
              Edit dataset
            </DropdownMenuItem>
            <DropdownMenuItem
              data-smoke-trigger="partner-exports-sheet"
              data-smoke-write="safe"
              onClick={() => setIsPartnerExportsOpen(true)}
            >
              <FileOutputIcon aria-hidden="true" />
              Partner exports
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DatasetPartnerExports
        datasetId={partnerExportDatasetId}
        sourceColumns={sourceColumns}
        managerOpen={isPartnerExportsOpen}
        onManagerOpenChange={setIsPartnerExportsOpen}
        showTrigger={false}
      />
    </>
  );
}
