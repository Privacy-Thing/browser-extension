import type { ComponentProps } from "react";

import { fireAndForget } from "@/shared/async";
import { SettingsEmptyState } from "@/ui/components/SettingsEmptyState";
import { SettingsHelpCard } from "@/ui/components/SettingsHelpCard";
import { SettingsSectionCard } from "@/ui/components/SettingsSectionCard";
import { Button } from "@/ui/components/ui/button";
import { Checkbox } from "@/ui/components/ui/checkbox";
import { TableSearchInput } from "@/ui/components/ui/table-search-input";
import { TableToolbar } from "@/ui/components/ui/table-toolbar";
import { TabsContent } from "@/ui/components/ui/tabs";
import { t } from "@/ui/i18n";
import { ContainerEditorModal } from "@/ui/options/components/modals/ContainerEditorModal";
import {
  type ContainerRow,
  ContainersTable,
} from "@/ui/options/components/tabs/containers-table";
import { PAGE_ANCHORS, SECTION_ANCHORS } from "@/ui/options/navigation";
import { icon } from "@/ui/options/utils";

const containersT = t.firefoxContainers;

const ContainersHelp = () => (
  <SettingsHelpCard
    anchorId={SECTION_ANCHORS.containers.help}
    copyLabel={t.common.copyLinkTo(containersT.copyLinkHelpLabel)}
    title={containersT.help.title}
  >
    <p className="text-sm text-muted-foreground">{containersT.help.body1}</p>
    <p className="text-sm text-muted-foreground">{containersT.help.body2}</p>
    <p className="text-sm text-muted-foreground">{containersT.help.body3}</p>
  </SettingsHelpCard>
);

const ContainerPanel = ({
  children,
  headerActions,
}: {
  children: React.ReactNode;
  headerActions?: React.ReactNode;
}) => (
  <SettingsSectionCard
    anchorId={SECTION_ANCHORS.containers.overview}
    copyLabel={t.common.copyLinkTo(containersT.copyLinkLabel)}
    title={<h2 className="text-xl font-semibold">{containersT.title}</h2>}
    description={containersT.description}
    {...(headerActions ? { headerActions } : {})}
    contentClassName="gap-4 pt-6"
  >
    {children}
  </SettingsSectionCard>
);

const UnavailableView = ({ refresh }: { refresh: () => Promise<void> }) => (
  <TabsContent
    value="containers"
    data-panel="containers"
    id={PAGE_ANCHORS.containers}
    className="outline-none"
  >
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-12 lg:col-span-8">
        <ContainerPanel>
          <SettingsEmptyState
            variant="muted"
            title={containersT.unavailableTitle}
            description={containersT.unavailableBody}
            hint={containersT.unavailableHint}
            actions={
              <Button
                variant="outline"
                size="sm"
                onClick={() => fireAndForget(refresh())}
              >
                {icon("fa-rotate", "mr-2")}
                {containersT.refreshButton}
              </Button>
            }
          />
        </ContainerPanel>
      </div>
      <div className="col-span-12 lg:col-span-4">
        <ContainersHelp />
      </div>
    </div>
  </TabsContent>
);

type ListProps = {
  create: () => void;
  deleteRow: (row: ContainerRow) => Promise<void>;
  editRow: (row: ContainerRow) => void;
  emptyDescription: string;
  filterQuery: string;
  openFallback: () => void;
  refresh: () => Promise<void>;
  rows: ContainerRow[];
  setFilterQuery: (value: string) => void;
  setShowInactive: (value: boolean) => void;
  showInactive: boolean;
  showEmptyTitle: boolean;
};

const ContainerList = (props: ListProps) => (
  <ContainerPanel
    headerActions={
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => fireAndForget(props.refresh())}
          aria-label={containersT.refreshTitle}
          title={containersT.refreshTitle}
        >
          {icon("fa-rotate")}
        </Button>
        <Button className="shrink-0" onClick={props.create}>
          {icon("fa-plus")}
          {containersT.createButton}
        </Button>
      </div>
    }
  >
    <TableToolbar
      search={
        <div className="max-w-sm">
          <TableSearchInput
            aria-label={containersT.filterPlaceholder}
            value={props.filterQuery}
            onChange={(event) => props.setFilterQuery(event.currentTarget.value)}
            placeholder={containersT.filterPlaceholder}
          />
        </div>
      }
    />
    {props.rows.length === 0 ? (
      <SettingsEmptyState
        variant="muted"
        centered
        title={props.showEmptyTitle ? containersT.emptyTitle : undefined}
        description={props.emptyDescription}
      />
    ) : (
      <ContainersTable
        rows={props.rows}
        openFallback={props.openFallback}
        editRow={props.editRow}
        deleteRow={props.deleteRow}
      />
    )}
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <Checkbox
          checked={props.showInactive}
          onChange={(event) => props.setShowInactive(event.target.checked)}
        />
        <span>{containersT.showInactiveLabel}</span>
      </label>
    </div>
  </ContainerPanel>
);

export type ContainersViewProps = ListProps & {
  editor: ComponentProps<typeof ContainerEditorModal>;
  status: "loading" | "ready" | "unavailable";
};

export const ContainersView = (props: ContainersViewProps) => {
  if (props.status === "unavailable")
    return <UnavailableView refresh={props.refresh} />;
  return (
    <TabsContent
      value="containers"
      data-panel="containers"
      id={PAGE_ANCHORS.containers}
      className="outline-none"
    >
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8">
          <ContainerList {...props} />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <ContainersHelp />
        </div>
      </div>
      <ContainerEditorModal {...props.editor} />
    </TabsContent>
  );
};
