import { BRAND_DISPLAY_NAME } from "@/shared/brand";
export const cleanupEn = {
  title: "Disconnect Control D?",
  deleteChoice: `Disconnect and delete what ${BRAND_DISPLAY_NAME} created`,
  keepChoice: "Disconnect",
  keepDescription:
    "Forget the API key and stop sync. Remote resources and browser DNS settings remain.",
  review: "Review deletion plan",
  planTitle: "Review what will be deleted",
  planDescription:
    "Only recorded resources with matching names and unchanged content can be deleted. Skipped resources will remain.",
  dnsWarning:
    "First switch your browser’s Secure DNS provider away from this Control D resolver. Deleting an endpoint breaks name resolution on every device still using it. Browser DNS settings are not changed here.",
  dnsConfirmed: "I have changed my browser’s DNS",
  confirm: "Confirm deletion and disconnect",
  resultTitle: "Cleanup results",
  retry: "Review and retry failures",
  retainedKey:
    "Sync has stopped. The API key and remaining ownership records are retained locally for retry. Disconnect without deletion to forget the key now.",
  finished: "Sync has stopped and the API key has been forgotten.",
  close: "Close",
  cancel: "Cancel",
  working: "Working…",
  failedRequest: "The cleanup request failed. Review the plan again before retrying.",
  deleteLabel: "Will delete",
  skipped: "Skipped",
  deleted: "Deleted",
  failed: "Failed",
  folder: "Folder",
  rule: "Rule",
  service: "Service override",
  endpoint: "Endpoint",
  profile: "Profile",
  nameChanged: "The remote name no longer matches.",
  contentChanged:
    "The remote content differs from the last recorded state, or ownership cannot be verified.",
  notRecorded: `This resource was not recorded as created by ${BRAND_DISPLAY_NAME}.`,
  containsPreserved: "Contains or depends on resources that must be preserved.",
  sharedProfile: "Another endpoint uses this profile.",
  alreadyDeleted: "Already deleted.",
  dependencyFailed: "A required deletion failed; retry it first.",
  empty: "No recorded resources to delete.",
  forgetKey: "Disconnect and forget the key",
};
export type CleanupMessages = { [K in keyof typeof cleanupEn]: string };
