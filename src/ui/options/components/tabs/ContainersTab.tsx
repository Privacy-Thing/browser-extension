import { useContainersModel } from "@/ui/options/components/tabs/containers-model";
import { ContainersView } from "@/ui/options/components/tabs/containers-view";

export const ContainersTab = () => <ContainersView {...useContainersModel()} />;
