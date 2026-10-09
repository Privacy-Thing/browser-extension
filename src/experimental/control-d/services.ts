// Service metadata and profile actions do not expose the service's domain scope.
export type ControlDService = {
  pk: string;
  name: string;
  category: string;
};

export type ControlDProfileService = ControlDService & {
  action: number;
  status: 0 | 1;
  via: string | null;
  viaV6: string | null;
};

const recordValue = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const stringValue = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

// The catalogue includes numeric PK/name values, for example the service 1688.
const serviceText = (value: unknown): string | null =>
  typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : stringValue(value);

const numberValue = (value: unknown): number | null => {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const serviceRecords = (payload: unknown): Record<string, unknown>[] | null => {
  const response = recordValue(payload);
  if (!response || response.success === false) return null;
  const services = recordValue(response.body)?.services;
  if (!Array.isArray(services)) return null;
  const records = services.map(recordValue);
  return records.every((record) => record !== null) ? records : null;
};

const serviceMetadata = (record: Record<string, unknown>): ControlDService | null => {
  const pk = serviceText(record.PK);
  const name = serviceText(record.name);
  const category = stringValue(record.category);
  return pk && name && category ? { pk, name, category } : null;
};

export const parseControlDServices = (payload: unknown): ControlDService[] | null => {
  const services = serviceRecords(payload)?.map(serviceMetadata);
  return services?.every((service) => service !== null) ? services : null;
};

export const parseProfileServices = (
  payload: unknown,
): ControlDProfileService[] | null => {
  const records = serviceRecords(payload);
  if (!records) return null;
  const services: ControlDProfileService[] = [];
  for (const record of records) {
    const metadata = serviceMetadata(record);
    const action = recordValue(record.action);
    const actionCode = numberValue(action?.do);
    const status = numberValue(action?.status);
    if (
      !metadata ||
      !action ||
      actionCode === null ||
      ![0, 1, 2, 3].includes(actionCode) ||
      (status !== 0 && status !== 1)
    ) {
      return null;
    }
    services.push({
      ...metadata,
      action: actionCode,
      status,
      via: stringValue(action.via),
      viaV6: stringValue(action.via_v6),
    });
  }
  return services;
};
