import type { CleanupMessages } from "./cleanup-copy-en";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";
export const cleanupZhCN = {
  title: "断开与 Control D 的连接？",
  deleteChoice: `断开连接并删除 ${BRAND_DISPLAY_NAME} 创建的内容`,
  keepChoice: "断开连接",
  keepDescription: "清除 API 密钥并停止同步。远程资源和浏览器 DNS 设置会保留。",
  review: "检查删除计划",
  planTitle: "检查将被删除的内容",
  planDescription:
    "只有名称匹配且内容未更改的已记录资源才能被删除。被跳过的资源将会保留。",
  dnsWarning:
    "请先将浏览器的安全 DNS 提供商从此 Control D 解析器切换为其他提供商。删除端点会导致仍在使用它的所有设备无法进行域名解析。此处不会更改浏览器 DNS 设置。",
  dnsConfirmed: "我已更改浏览器的 DNS",
  confirm: "确认删除并断开连接",
  resultTitle: "清理结果",
  retry: "检查并重试失败项",
  retainedKey:
    "同步已停止。API 密钥和剩余的所有权记录会保留在本地，以便重试。如需立即清除密钥，请选择断开连接但不删除。",
  finished: "同步已停止，API 密钥已清除。",
  close: "关闭",
  cancel: "取消",
  working: "正在处理…",
  failedRequest: "清理请求失败。重试前请再次检查计划。",
  deleteLabel: "将删除",
  skipped: "已跳过",
  deleted: "已删除",
  failed: "失败",
  folder: "文件夹",
  rule: "规则",
  service: "服务覆盖",
  endpoint: "端点",
  profile: "配置文件",
  nameChanged: "远程名称已不再匹配。",
  contentChanged: "远程内容与上次记录的状态不同，或无法验证所有权。",
  notRecorded: `此资源未被记录为由 ${BRAND_DISPLAY_NAME} 创建。`,
  containsPreserved: "包含或依赖于必须保留的资源。",
  sharedProfile: "另一个端点正在使用此配置文件。",
  alreadyDeleted: "已删除。",
  dependencyFailed: "必需的删除操作失败；请先重试该操作。",
  empty: "没有可删除的已记录资源。",
  forgetKey: "断开连接并清除密钥",
} satisfies CleanupMessages;
