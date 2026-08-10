import { fireAndForget } from "@/shared/async";
import {
  DEFAULT_CONTAINER_COLOR,
  DEFAULT_CONTAINER_ICON,
} from "@/shared/firefox-containers";
import type { ContainerAssignment, ContainerPresentation } from "@/shared/types";
import { cn } from "@/ui/components/lib/utils";
import { Button } from "@/ui/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/components/ui/table";
import { t } from "@/ui/i18n";
import type { ContainerEditorDraft } from "@/ui/options/components/modals/ContainerEditorModal";
import { icon } from "@/ui/options/utils";

const containersT = t.firefoxContainers;

export type ContainerRow = {
  id: string;
  kind: "default-rule" | "container";
  cookieStoreId: string | null;
  name: string;
  description: string | null;
  badgeLabel: string | null;
  iconUrl: string;
  colorCode: string;
  isOrphaned: boolean;
  isInactive: boolean;
  assignmentLocationId: string | null;
  assignmentLabel: string;
  container: ContainerPresentation | null;
};

export const getAssignmentLabel = (
  locationId: string | null | undefined,
  profileLabels: ReadonlyMap<string, string>,
): string =>
  locationId
    ? (profileLabels.get(locationId) ?? containersT.missingLocation)
    : containersT.noLocationAssigned;

export const compareContainerRows = (
  left: ContainerRow,
  right: ContainerRow,
): number => {
  if (left.kind === "default-rule") return -1;
  if (right.kind === "default-rule") return 1;
  return Number(left.isOrphaned) - Number(right.isOrphaned);
};

export const createEditorDraft = (
  container?: ContainerPresentation | null,
  assignment?: ContainerAssignment | null,
): ContainerEditorDraft => ({
  name: container?.name ?? "",
  color: container?.color ?? DEFAULT_CONTAINER_COLOR,
  icon: container?.icon ?? DEFAULT_CONTAINER_ICON,
  enabled: assignment?.enabled ?? true,
  locationId: assignment?.locationId ?? null,
  surfaceOverrides: assignment?.fingerprintSurfaceOverrides,
});

const ContainerIcon = ({
  colorCode,
  iconUrl,
}: {
  colorCode: string;
  iconUrl: string;
}) =>
  iconUrl ? (
    <span
      aria-hidden="true"
      className="block h-5 w-5 bg-current"
      style={{
        color: colorCode || "currentColor",
        maskImage: `url("${iconUrl}")`,
        maskRepeat: "no-repeat",
        maskPosition: "center",
        maskSize: "contain",
        WebkitMaskImage: `url("${iconUrl}")`,
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        WebkitMaskSize: "contain",
      }}
    />
  ) : (
    <span
      aria-hidden="true"
      className="block h-2.5 w-2.5 rounded-full bg-muted-foreground/60"
      style={colorCode ? { backgroundColor: colorCode } : undefined}
    />
  );

const getLocationClass = (row: ContainerRow): string => {
  if (!row.assignmentLocationId || !row.assignmentLabel) return "text-muted-foreground";
  return row.isOrphaned || row.isInactive ? "text-muted-foreground" : "text-foreground";
};

type RowProps = {
  deleteRow: (row: ContainerRow) => Promise<void>;
  editRow: (row: ContainerRow) => void;
  openFallback: () => void;
  row: ContainerRow;
};

const ContainerTableRow = ({ deleteRow, editRow, openFallback, row }: RowProps) => {
  const muted = row.isOrphaned || row.isInactive;
  const editTitle =
    row.kind === "default-rule"
      ? t.rules.globalFallback.editTitle
      : containersT.editActionTitle(row.name);
  const editLabel =
    row.kind === "default-rule"
      ? t.rules.globalFallback.editAriaLabel
      : containersT.editActionTitle(row.name);
  const deleteTitle = row.isOrphaned
    ? containersT.removeAssignmentActionTitle(row.name)
    : containersT.deleteActionTitle(row.name);
  const handleEdit = (): void => {
    if (row.kind === "default-rule") openFallback();
    else editRow(row);
  };
  return (
    <TableRow
      className={cn(
        "border-b last:border-0 odd:bg-muted/20 hover:bg-muted/30 transition-colors",
        muted && "bg-muted/20 text-muted-foreground",
      )}
    >
      <TableCell className="px-3 py-3">
        <div className={cn("flex items-center gap-3", muted && "opacity-55")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center text-foreground">
            {row.kind === "default-rule" ? (
              <span className="text-muted-foreground">{icon("fa-shield-halved")}</span>
            ) : (
              <ContainerIcon iconUrl={row.iconUrl} colorCode={row.colorCode} />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "truncate text-sm font-medium text-foreground",
                  muted && "text-muted-foreground",
                )}
              >
                {row.name}
              </span>
              {row.badgeLabel ? (
                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {row.badgeLabel}
                </span>
              ) : null}
            </div>
            {row.description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{row.description}</p>
            ) : null}
          </div>
        </div>
      </TableCell>
      <TableCell className="px-3 py-3 text-sm">
        <span className={cn("block truncate", getLocationClass(row))}>
          {row.assignmentLabel}
        </span>
      </TableCell>
      <TableCell className="px-3 py-3">
        <div className="flex items-center gap-1.5 justify-end">
          {!row.isOrphaned ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={editLabel}
              title={editTitle}
              onClick={handleEdit}
            >
              {icon("fa-pen")}
            </Button>
          ) : null}
          {row.kind === "container" ? (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              aria-label={deleteTitle}
              title={deleteTitle}
              onClick={() => fireAndForget(deleteRow(row))}
            >
              {icon("fa-trash")}
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
};

export const ContainersTable = ({
  deleteRow,
  editRow,
  openFallback,
  rows,
}: {
  deleteRow: (row: ContainerRow) => Promise<void>;
  editRow: (row: ContainerRow) => void;
  openFallback: () => void;
  rows: ContainerRow[];
}) => (
  <div className="overflow-hidden rounded-md border">
    <Table className="gw-rules-table w-full table-fixed text-sm">
      <TableHeader>
        <TableRow className="border-b bg-muted/40">
          <TableHead className="px-3 py-3 text-left font-semibold">
            {containersT.columns.container}
          </TableHead>
          <TableHead className="w-[10rem] px-3 py-3 text-left font-semibold">
            {containersT.columns.location}
          </TableHead>
          <TableHead className="w-[6.5rem] px-3 py-3 text-right font-semibold">
            {containersT.columns.actions}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <ContainerTableRow
            key={row.id}
            row={row}
            openFallback={openFallback}
            editRow={editRow}
            deleteRow={deleteRow}
          />
        ))}
      </TableBody>
    </Table>
  </div>
);
