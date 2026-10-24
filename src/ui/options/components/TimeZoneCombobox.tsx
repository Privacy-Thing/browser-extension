import { Combobox } from "@/ui/components/ui/combobox";
import { t } from "@/ui/i18n";

const timezoneOptions = [
  ...new Set(["UTC", ...Intl.supportedValuesOf("timeZone")]),
].map((tz) => ({
  value: tz,
  label: tz.replace(/_/g, " "),
}));

type TimeZoneComboboxProps = {
  /** An empty value shows the placeholder; any other value is kept selectable. */
  value: string;
  onValueChange: (timeZone: string) => void;
  disabled?: boolean | undefined;
  ariaLabel?: string | undefined;
  "aria-labelledby"?: string | undefined;
  placeholder?: string | undefined;
};

/** Searchable list of the time zones this browser supports. */
export const TimeZoneCombobox = ({
  value,
  onValueChange,
  disabled,
  ariaLabel,
  "aria-labelledby": ariaLabelledby,
  placeholder,
}: TimeZoneComboboxProps) => (
  <Combobox
    options={
      !value || timezoneOptions.some((option) => option.value === value)
        ? timezoneOptions
        : [{ value, label: value }, ...timezoneOptions]
    }
    value={value}
    {...(ariaLabel ? { ariaLabel } : {})}
    {...(ariaLabelledby ? { "aria-labelledby": ariaLabelledby } : {})}
    {...(placeholder ? { placeholder } : {})}
    onValueChange={(timeZone) => {
      if (timeZone) onValueChange(timeZone);
    }}
    searchPlaceholder={t.common.fields.timeZone}
    disabled={disabled ?? false}
  />
);
