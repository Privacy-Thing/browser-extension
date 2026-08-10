import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

const meta = {
  title: "Components/Card",
  component: Card,
  tags: ["autodocs"],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Location</CardTitle>
        <CardDescription>Configure a spoofing location.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid w-full items-center gap-4">
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="Location name" />
          </div>
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="lat">Latitude</Label>
            <Input id="lat" placeholder="48.8566" />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline">Cancel</Button>
        <Button>Save</Button>
      </CardFooter>
    </Card>
  ),
};

export const Simple: Story = {
  render: () => (
    <Card className="w-[250px]">
      <CardHeader>
        <CardTitle>Warsaw</CardTitle>
        <CardDescription>52.23°N, 21.01°E</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Unused</p>
      </CardContent>
    </Card>
  ),
};
