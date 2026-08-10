import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { FieldLabel } from "../ui/field-label";
import { TagsInput } from "../ui/tags-input";

const meta = {
  title: "Components/TagsInput",
  component: TagsInput,
  tags: ["autodocs"],
  args: { ariaLabel: "Languages" },
} satisfies Meta<typeof TagsInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    defaultValue: ["en-US", "fr-FR"],
    placeholder: "Add language...",
  },
};

function ControlledExample() {
  const [tags, setTags] = useState(["en-US", "fr-FR", "de-DE"]);
  return (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <FieldLabel>Languages</FieldLabel>
      <TagsInput
        value={tags}
        onChange={setTags}
        placeholder="Add language..."
        ariaLabel="Languages"
      />
      <p className="text-xs text-muted-foreground">
        {tags.length} language{tags.length !== 1 ? "s" : ""}: {tags.join(", ")}
      </p>
    </div>
  );
}

export const Controlled: Story = {
  render: () => <ControlledExample />,
};

function ControlledInfoExample() {
  const [tags, setTags] = useState(["pl-PL", "pl"]);
  return (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <FieldLabel
        info="This list shapes navigator.languages and the Accept-Language order sites receive."
        infoLabel="What languages means"
      >
        Languages
      </FieldLabel>
      <TagsInput
        value={tags}
        onChange={setTags}
        placeholder="Add language..."
        ariaLabel="Languages"
      />
    </div>
  );
}

export const ControlledWithInfo: Story = {
  render: () => <ControlledInfoExample />,
};

export const MaxTags: Story = {
  args: {
    defaultValue: ["en-US", "fr-FR"],
    placeholder: "Max 3 tags...",
    maxTags: 3,
  },
};

export const Empty: Story = {
  args: {
    placeholder: "Type and press Enter...",
  },
};

export const Disabled: Story = {
  args: {
    defaultValue: ["en-US", "fr-FR"],
    disabled: true,
  },
};
