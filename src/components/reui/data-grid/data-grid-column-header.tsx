"use client"

import { HTMLAttributes, memo, ReactNode, useMemo } from "react"
import {
  getColumnHeaderLabel,
  useDataGrid,
} from "@/components/reui/data-grid/data-grid"
import { Column } from "@tanstack/react-table"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useDatasetPerfRenderTrace } from "@/lib/render-trace"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon, CheckIcon, ArrowLeftToLineIcon, ArrowRightToLineIcon, ArrowLeftIcon, ArrowRightIcon, Settings2Icon, PinOffIcon } from "lucide-react"

const EMPTY_COLUMN_ORDER: string[] = []

interface DataGridColumnHeaderProps<
  TData,
  TValue,
> extends HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>
  /** When omitted, uses `column.columnDef.meta.headerTitle`, then a string `columnDef.header`, then `column.id`. */
  title?: string
  icon?: ReactNode
  detail?: ReactNode
  pinnable?: boolean
  filter?: ReactNode
  visibility?: boolean
  renderStateKey?: string
}

function DataGridColumnHeaderInner<TData, TValue>({
  column,
  title,
  icon,
  detail,
  className,
  filter,
  visibility = false,
  renderStateKey,
}: DataGridColumnHeaderProps<TData, TValue>) {
  useDatasetPerfRenderTrace("DataGridColumnHeaderInner", column.id)
  void renderStateKey
  const { isLoading, table, props, recordCount } = useDataGrid()
  const resolvedTitle = title ?? getColumnHeaderLabel(column)
  const columnsMovable = props.tableLayout?.columnsMovable ?? false
  const columnsVisibilityEnabled =
    props.tableLayout?.columnsVisibility && visibility

  const columnOrder = columnsMovable ? table.getState().columnOrder : EMPTY_COLUMN_ORDER
  const columnVisibilityKey = columnsVisibilityEnabled
    ? JSON.stringify(table.getState().columnVisibility)
    : ""
  const isSorted = column.getIsSorted()
  const isPinned = column.getIsPinned()
  const canSort = column.getCanSort()
  const canPin = column.getCanPin()
  const canResize = column.getCanResize()

  const columnIndex = columnOrder.indexOf(column.id)
  const canMoveLeft = columnsMovable && columnIndex > 0
  const canMoveRight =
    columnsMovable && columnIndex < columnOrder.length - 1

  const handleSort = () => {
    if (isSorted === "asc") {
      column.toggleSorting(true)
    } else if (isSorted === "desc") {
      column.clearSorting()
    } else {
      column.toggleSorting(false)
    }
  }

  const headerLabelClassName = cn(
    "text-secondary-foreground/80 inline-flex h-full items-center gap-1.5 font-normal [&_svg]:opacity-60 text-[0.8125rem] leading-[calc(1.125/0.8125)] [&_svg]:size-3.5",
    className
  )

  const headerButtonClassName = cn(
    "text-secondary-foreground/80 hover:bg-secondary data-[state=open]:bg-secondary hover:text-foreground data-[state=open]:text-foreground -ms-2 px-2 font-normal h-6 rounded-lg",
    className
  )

  const sortIcon =
    canSort &&
    (isSorted === "desc" ? (
      <ArrowDownIcon className="size-3.25" />
    ) : isSorted === "asc" ? (
      <ArrowUpIcon className="size-3.25" />
    ) : (
      <ChevronsUpDownIcon className="mt-px size-3.25" />
    ))

  const hasControls =
    props.tableLayout?.columnsMovable ||
    columnsVisibilityEnabled ||
    (props.tableLayout?.columnsPinnable && canPin) ||
    filter

  const menuItems = useMemo(() => {
    const items: ReactNode[] = []
    let hasPreviousSection = false

    // Filter section
    if (filter) {
      items.push(
        <DropdownMenuGroup key="group-filter">
          <DropdownMenuLabel key="filter">{filter}</DropdownMenuLabel>
        </DropdownMenuGroup>
      )
      hasPreviousSection = true
    }

    // Sort section
    if (canSort) {
      if (hasPreviousSection) {
        items.push(<DropdownMenuSeparator key="sep-sort" />)
      }
      items.push(
        <DropdownMenuItem
          key="sort-asc"
          onClick={() => {
            if (isSorted === "asc") {
              column.clearSorting()
            } else {
              column.toggleSorting(false)
            }
          }}
          disabled={!canSort}
        >
          <ArrowUpIcon className="size-3.5!" />
          <span className="grow">Asc</span>
          {isSorted === "asc" && (
            <CheckIcon className="text-primary size-4 opacity-100!" />
          )}
        </DropdownMenuItem>,
        <DropdownMenuItem
          key="sort-desc"
          onClick={() => {
            if (isSorted === "desc") {
              column.clearSorting()
            } else {
              column.toggleSorting(true)
            }
          }}
          disabled={!canSort}
        >
          <ArrowDownIcon className="size-3.5!" />
          <span className="grow">Desc</span>
          {isSorted === "desc" && (
            <CheckIcon className="text-primary size-4 opacity-100!" />
          )}
        </DropdownMenuItem>
      )
      hasPreviousSection = true
    }

    // Pin section
    if (props.tableLayout?.columnsPinnable && canPin) {
      if (hasPreviousSection) {
        items.push(<DropdownMenuSeparator key="sep-pin" />)
      }
      items.push(
        <DropdownMenuItem
          key="pin-left"
          onClick={() => column.pin(isPinned === "left" ? false : "left")}
        >
          <ArrowLeftToLineIcon className="size-3.5!" aria-hidden="true" />
          <span className="grow">Pin to left</span>
          {isPinned === "left" && (
            <CheckIcon className="text-primary size-4 opacity-100!" />
          )}
        </DropdownMenuItem>,
        <DropdownMenuItem
          key="pin-right"
          onClick={() => column.pin(isPinned === "right" ? false : "right")}
        >
          <ArrowRightToLineIcon className="size-3.5!" aria-hidden="true" />
          <span className="grow">Pin to right</span>
          {isPinned === "right" && (
            <CheckIcon className="text-primary size-4 opacity-100!" />
          )}
        </DropdownMenuItem>
      )
      hasPreviousSection = true
    }

    // Move section
    if (columnsMovable) {
      if (hasPreviousSection) {
        items.push(<DropdownMenuSeparator key="sep-move" />)
      }
      items.push(
        <DropdownMenuItem
          key="move-left"
          onClick={() => {
            if (columnIndex > 0) {
              const newOrder = [...columnOrder]
              const [movedColumn] = newOrder.splice(columnIndex, 1)
              newOrder.splice(columnIndex - 1, 0, movedColumn)
              table.setColumnOrder(newOrder)
            }
          }}
          disabled={!canMoveLeft || isPinned !== false}
        >
          <ArrowLeftIcon className="size-3.5!" aria-hidden="true" />
          <span>Move to Left</span>
        </DropdownMenuItem>,
        <DropdownMenuItem
          key="move-right"
          onClick={() => {
            if (columnIndex < columnOrder.length - 1) {
              const newOrder = [...columnOrder]
              const [movedColumn] = newOrder.splice(columnIndex, 1)
              newOrder.splice(columnIndex + 1, 0, movedColumn)
              table.setColumnOrder(newOrder)
            }
          }}
          disabled={!canMoveRight || isPinned !== false}
        >
          <ArrowRightIcon className="size-3.5!" aria-hidden="true" />
          <span>Move to Right</span>
        </DropdownMenuItem>
      )
      hasPreviousSection = true
    }

    // Visibility section
    if (columnsVisibilityEnabled) {
      if (hasPreviousSection) {
        items.push(<DropdownMenuSeparator key="sep-visibility" />)
      }
      items.push(
        <DropdownMenuSub key="visibility">
          <DropdownMenuSubTrigger>
            <Settings2Icon className="size-3.5!" />
            <span>Columns</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent side="right">
            {table
              .getAllColumns()
              .filter((col) => col.getCanHide())
              .map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={col.getIsVisible()}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={(value) => col.toggleVisibility(!!value)}
                  className="capitalize"
                >
                  {getColumnHeaderLabel(col)}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )
    }

    return items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filter,
    canSort,
    isSorted,
    column,
    props.tableLayout?.columnsPinnable,
    columnsMovable,
    columnsVisibilityEnabled,
    canPin,
    isPinned,
    canMoveLeft,
    canMoveRight,
    visibility,
    table,
    columnIndex,
    columnOrder,
    columnVisibilityKey, // Needed to update checkbox states when visibility changes
  ])

  if (hasControls) {
    return (
      <div className="flex h-full items-center justify-between gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className={headerButtonClassName}
                disabled={isLoading || recordCount === 0}
              >
                {icon && icon}
                {resolvedTitle}
                {sortIcon}
              </Button>
            }
          />
          <DropdownMenuContent className="w-40" align="start">
            {menuItems}
          </DropdownMenuContent>
        </DropdownMenu>
        {detail ? <div className="shrink-0">{detail}</div> : null}
        {props.tableLayout?.columnsPinnable && canPin && isPinned && (
          <Button
            size="icon-sm"
            variant="ghost"
            className="-me-1 size-7 rounded-md"
            onClick={() => column.pin(false)}
            aria-label={`Unpin ${resolvedTitle} column`}
            title={`Unpin ${resolvedTitle} column`}
          >
            <PinOffIcon className="size-3.5! opacity-50!" aria-hidden="true" />
          </Button>
        )}
      </div>
    )
  }

  if (canSort || (props.tableLayout?.columnsResizable && canResize)) {
    return (
      <div className="flex h-full items-center gap-1.5">
        <Button
          variant="ghost"
          className={headerButtonClassName}
          disabled={isLoading || recordCount === 0}
          onClick={handleSort}
        >
          {icon && icon}
          {resolvedTitle}
          {sortIcon}
        </Button>
        {detail ? <div className="shrink-0">{detail}</div> : null}
      </div>
    )
  }

  return (
    <div className={headerLabelClassName}>
      {icon && icon}
      {resolvedTitle}
      {detail ? <span className="shrink-0">{detail}</span> : null}
    </div>
  )
}

const DataGridColumnHeader = memo(
  DataGridColumnHeaderInner
) as typeof DataGridColumnHeaderInner

export { DataGridColumnHeader, type DataGridColumnHeaderProps }
