import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";

import { Badge } from "../ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

const meta = {
  title: "Components/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  parameters: { a11y: { test: "error" } },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="locations" className="w-[400px]">
      <TabsList>
        <TabsTrigger value="locations">Locations</TabsTrigger>
        <TabsTrigger value="rules">Rules</TabsTrigger>
        <TabsTrigger value="profiles">
          Preview feature{" "}
          <Badge variant="info" className="ml-1.5">
            Experimental
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="advanced">Advanced</TabsTrigger>
      </TabsList>
      <TabsContent value="locations">
        <Card>
          <CardHeader>
            <CardTitle>Locations</CardTitle>
            <CardDescription>Manage your spoofing locations.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">12 locations configured.</p>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="rules">
        <Card>
          <CardHeader>
            <CardTitle>Rules</CardTitle>
            <CardDescription>Domain matching rules.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">2 rules active.</p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  ),
};

export const DefaultInteractionTest: Story = {
  ...Default,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const locationsTab = canvas.getByRole("tab", { name: "Locations" });
    locationsTab.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByRole("tab", { name: "Rules" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByText("2 rules active.")).toBeVisible();
  },
};
