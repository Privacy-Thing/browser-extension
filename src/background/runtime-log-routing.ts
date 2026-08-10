import { LogCategory } from "@/shared/types";

export const resolveLogCategory = (event: string): LogCategory => {
  const component = event.split(".")[0];
  if (component === "Geolocation" || component === "Permissions") {
    return LogCategory.Geo;
  }

  if (
    component === "Intl" ||
    component === "Locale" ||
    component === "Navigator" ||
    component === "ClientHints"
  ) {
    return LogCategory.Locale;
  }

  if (component === "Date") {
    return LogCategory.Date;
  }

  return LogCategory.System;
};
