"use client"

import { createContext, ReactNode, useContext, useMemo } from "react"
import {
  Column,
  ColumnFiltersState,
  RowData,
  SortingState,
  Table,
} from "@tanstack/react-table"

import { cn } from "@/lib/utils"
import { useDatasetPerfRenderTrace } from "@/lib/render-trace"

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    headerTitle?: string
    headerClassName?: string
    cellClassName?: string
    skeleton?: ReactNode
    expandedContent?: (row: TData) => ReactNode
  }
}

/** Label for headers / column visibility: `meta.headerTitle`, string `columnDef.header`, or `column.id`. */
export function getColumnHeaderLabel<TData, TValue>(
  column: Column<TData, TValue>
): string {
  const meta = column.columnDef.meta as { headerTitle?: string } | undefined
  if (typeof meta?.headerTitle === "string") return meta.headerTitle
  const defHeader = column.columnDef.header
  if (typeof defHeader === "string") return defHeader
  return String(column.id)
}

export type DataGridApiFetchParams = {
  pageIndex: number
  pageSize: number
  sorting?: SortingState
  filters?: ColumnFiltersState
  searchQuery?: string
}

export type DataGridApiResponse<T> = {
  data: T[]
  empty: boolean
  pagination: {
    total: number
    page: number
  }
}

export interface DataGridContextProps<TData extends object> {
  props: DataGridProps<TData>
  table: Table<TData>
  recordCount: number
  isLoading: boolean
}

export type DataGridRequestParams = {
  pageIndex: number
  pageSize: number
  sorting?: SortingState
  columnFilters?: ColumnFiltersState
}

export interface DataGridProps<TData extends object> {
  className?: string
  table?: Table<TData>
  recordCount: number
  children?: ReactNode
  onRowClick?: (row: TData) => void
  isLoading?: boolean
  loadingMode?: "skeleton" | "spinner"
  loadingMessage?: ReactNode | string
  fetchingMoreMessage?: ReactNode | string
  allRowsLoadedMessage?: ReactNode | string
  emptyMessage?: ReactNode | string
  tableLayout?: {
    dense?: boolean
    cellBorder?: boolean
    rowBorder?: boolean
    rowRounded?: boolean
    stripped?: boolean
    headerBackground?: boolean
    headerBorder?: boolean
    headerSticky?: boolean
    width?: "auto" | "fixed"
    columnsVisibility?: boolean
    columnsResizable?: boolean
    columnsResizeMode?: "onChange" | "onEnd"
    columnsPinnable?: boolean
    columnsMovable?: boolean
    columnsDraggable?: boolean
    rowsDraggable?: boolean
    rowsPinnable?: boolean
  }
  tableClassNames?: {
    base?: string
    header?: string
    headerRow?: string
    headerSticky?: string
    body?: string
    bodyRow?: string
    footer?: string
    edgeCell?: string
  }
}

const DataGridContext = createContext<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DataGridContextProps<any> | undefined
>(undefined)

const DEFAULT_TABLE_LAYOUT = {
  dense: false,
  cellBorder: false,
  rowBorder: true,
  rowRounded: false,
  stripped: false,
  headerSticky: false,
  headerBackground: true,
  headerBorder: true,
  width: "fixed",
  columnsVisibility: false,
  columnsResizable: false,
  columnsResizeMode: "onEnd",
  columnsPinnable: false,
  columnsMovable: false,
  columnsDraggable: false,
  rowsDraggable: false,
  rowsPinnable: false,
} as const

const DEFAULT_TABLE_CLASS_NAMES = {
  base: "",
  header: "",
  headerRow: "",
  headerSticky: "sticky top-0 z-15 bg-background/90 backdrop-blur-xs",
  body: "",
  bodyRow: "",
  footer: "",
  edgeCell: "",
} as const

function useDataGrid() {
  const context = useContext(DataGridContext)
  if (!context) {
    throw new Error("useDataGrid must be used within a DataGridProvider")
  }
  return context
}

function DataGridProvider<TData extends object>({
  children,
  table,
  ...props
}: DataGridProps<TData> & { table: Table<TData> }) {
  const resolvedTableLayout = useMemo(
    () => ({
      ...DEFAULT_TABLE_LAYOUT,
      ...(props.tableLayout || {}),
    }),
    [props.tableLayout]
  )
  const resolvedTableClassNames = useMemo(
    () => ({
      ...DEFAULT_TABLE_CLASS_NAMES,
      ...(props.tableClassNames || {}),
    }),
    [props.tableClassNames]
  )
  const resolvedProps = useMemo<DataGridProps<TData>>(
    () => ({
      className: props.className,
      recordCount: props.recordCount,
      onRowClick: props.onRowClick,
      isLoading: props.isLoading,
      loadingMode: props.loadingMode ?? "skeleton",
      loadingMessage: props.loadingMessage,
      fetchingMoreMessage: props.fetchingMoreMessage,
      allRowsLoadedMessage: props.allRowsLoadedMessage,
      emptyMessage: props.emptyMessage,
      tableLayout: resolvedTableLayout,
      tableClassNames: resolvedTableClassNames,
    }),
    [
      props.allRowsLoadedMessage,
      props.className,
      props.emptyMessage,
      props.fetchingMoreMessage,
      props.isLoading,
      props.loadingMessage,
      props.loadingMode,
      props.onRowClick,
      props.recordCount,
      resolvedTableClassNames,
      resolvedTableLayout,
    ]
  )
  // Memoize context value so consumers don't re-render during column resize.
  // Column sizing state is intentionally excluded from deps -- CSS variables
  // on the <table> element handle width updates without React re-renders.
  const value = useMemo(
    () => ({
      props: resolvedProps,
      table,
      recordCount: resolvedProps.recordCount,
      isLoading: resolvedProps.isLoading || false,
    }),
    [
      table,
      resolvedProps,
    ]
  )

  return (
    <DataGridContext.Provider value={value}>
      {children}
    </DataGridContext.Provider>
  )
}

function DataGrid<TData extends object>({
  children,
  table,
  ...props
}: DataGridProps<TData>) {
  useDatasetPerfRenderTrace("DataGrid")
  // Ensure table is provided
  if (!table) {
    throw new Error('DataGrid requires a "table" prop')
  }

  return (
    <DataGridProvider table={table} {...props}>
      {children}
    </DataGridProvider>
  )
}

function DataGridContainer({
  children,
  className,
  border = true,
}: {
  children: ReactNode
  className?: string
  border?: boolean
}) {
  return (
    <div
      data-slot="data-grid"
      className={cn(
        "w-full overflow-hidden",
        border &&
          "border-border rounded-lg border",
        className
      )}
    >
      {children}
    </div>
  )
}

export { useDataGrid, DataGridProvider, DataGrid, DataGridContainer }
