import type { Meta, StoryObj } from "@storybook/react";

import { Combobox } from "../ui/combobox";
import { FormSection } from "../ui/form-section";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { NumberInput } from "../ui/number-input";
import { Slider } from "../ui/slider";

const languageOptions = [
  { value: "pl-PL", label: "Polish (Poland) [pl-PL]" },
  { value: "en-US", label: "English (United States) [en-US]" },
  { value: "de-DE", label: "German (Germany) [de-DE]" },
];

const meta = {
  title: "Components/FormSection",
  component: FormSection,
  tags: ["autodocs"],
} satisfies Meta<typeof FormSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Geolocation",
    children: null,
  },
  render: () => (
    <div className="w-full max-w-xl rounded-2xl border border-border/60 bg-background p-5">
      <FormSection
        title="Geolocation"
        description="Coordinates and accuracy used for this saved location."
      >
        <div>
          <Label variant="field" htmlFor="section-latitude" className="mb-2 block">
            Latitude
          </Label>
          <Input id="section-latitude" defaultValue="52.22959" />
        </div>
        <div>
          <Label variant="field" htmlFor="section-longitude" className="mb-2 block">
            Longitude
          </Label>
          <Input id="section-longitude" defaultValue="21.011859" />
        </div>
      </FormSection>
    </div>
  ),
};

export const Collapsed: Story = {
  args: {
    title: "Advanced",
    children: null,
  },
  render: () => (
    <div className="w-full max-w-xl rounded-2xl border border-border/60 bg-background p-5">
      <FormSection
        title="Advanced"
        description="Optional controls that you may only adjust occasionally."
        defaultOpen={false}
      >
        <div>
          <Label variant="field" htmlFor="section-advanced" className="mb-2 block">
            Hidden field
          </Label>
          <Input id="section-advanced" defaultValue="Example value" />
        </div>
      </FormSection>
    </div>
  ),
};

export const Plain: Story = {
  args: {
    title: "Time & language",
    children: null,
  },
  render: () => (
    <div className="w-full max-w-xl rounded-2xl border border-border/60 bg-background p-5">
      <FormSection
        title="Time & language"
        description="Keep locale-facing values aligned with the same region as the saved coordinates."
        variant="plain"
      >
        <div>
          <Label variant="field" htmlFor="plain-language" className="mb-2 block">
            Language
          </Label>
          <Combobox
            ariaLabel="Language"
            value="pl-PL"
            options={languageOptions}
            searchPlaceholder="Language"
          />
        </div>
        <div>
          <Label variant="field" htmlFor="plain-time-zone" className="mb-2 block">
            Time zone
          </Label>
          <Combobox
            ariaLabel="Time zone"
            value="Europe/Warsaw"
            options={[
              { value: "Europe/Warsaw", label: "Europe/Warsaw" },
              { value: "Europe/Berlin", label: "Europe/Berlin" },
            ]}
            searchPlaceholder="Time zone"
          />
        </div>
      </FormSection>
    </div>
  ),
};

export const LocationEditorLayout: Story = {
  args: {
    title: "Location editor layout",
    children: null,
  },
  render: () => (
    <div className="w-full max-w-xl rounded-2xl border border-border/60 bg-background p-5">
      <div className="flex flex-col gap-4">
        <div>
          <Label variant="field" htmlFor="location-name" className="mb-2 block">
            Location name
          </Label>
          <Input id="location-name" defaultValue="Warsaw" />
        </div>

        <FormSection
          title="Geolocation"
          description="Coordinates, accuracy, and the maximum spread allowed for spoofed positions."
          variant="plain"
        >
          <div>
            <Label variant="field" htmlFor="geo-latitude" className="mb-2 block">
              Latitude
            </Label>
            <NumberInput id="geo-latitude" value={52.22959} decimalScale={6} />
          </div>
          <div>
            <Label variant="field" htmlFor="geo-longitude" className="mb-2 block">
              Longitude
            </Label>
            <NumberInput id="geo-longitude" value={21.011859} decimalScale={6} />
          </div>
          <div>
            <Label variant="field" htmlFor="geo-accuracy" className="mb-2 block">
              Accuracy
            </Label>
            <NumberInput id="geo-accuracy" value={25} />
          </div>
          <div>
            <Label variant="field" className="mb-2 block">
              Radius (m)
            </Label>
            <Slider
              aria-label="Radius"
              value={[50]}
              min={0}
              max={500}
              valueLabel="50m"
              minLabel="0m"
              maxLabel="500m"
            />
          </div>
        </FormSection>

        <FormSection
          title="Time & language"
          description="Keep locale-facing values aligned with the same region as the saved coordinates."
          variant="plain"
        >
          <div>
            <Label variant="field" htmlFor="time-language" className="mb-2 block">
              Language
            </Label>
            <Combobox
              ariaLabel="Language"
              value="pl-PL"
              options={languageOptions}
              searchPlaceholder="Language"
            />
          </div>
          <div>
            <Label variant="field" htmlFor="time-zone" className="mb-2 block">
              Time zone
            </Label>
            <Combobox
              ariaLabel="Location profile"
              value="Europe/Warsaw"
              options={[
                { value: "Europe/Warsaw", label: "Europe/Warsaw" },
                { value: "Europe/Berlin", label: "Europe/Berlin" },
              ]}
              searchPlaceholder="Time zone"
            />
          </div>
        </FormSection>

        <FormSection
          title="Advanced"
          description="Behavior-driven reporting can be layered on top of this location."
          defaultOpen={false}
          variant="plain"
        >
          <div>
            <Label variant="field" htmlFor="behavior-profile" className="mb-2 block">
              Location profile
            </Label>
            <Combobox
              value=""
              options={[
                { value: "", label: "None (simple engine)" },
                { value: "balanced", label: "Balanced reporting" },
              ]}
              searchPlaceholder="Location profile"
            />
          </div>
        </FormSection>
      </div>
    </div>
  ),
};
