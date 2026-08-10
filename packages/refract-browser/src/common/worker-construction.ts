export const constructRevokedBlob = <TWorker>(
  blobUrl: string,
  revokeObjectURL: (url: string) => void,
  construct: (url: string) => TWorker,
): TWorker => {
  try {
    return construct(blobUrl);
  } finally {
    revokeObjectURL(blobUrl);
  }
};
