export const CUSTOMER_NOTICE_SETTINGS_COLLECTION = 'appSettings';
export const CUSTOMER_NOTICE_SETTINGS_DOC = 'customerOrderNotice';

export const DEFAULT_CUSTOMER_NOTICE = {
  enabled: false,
  message: '',
  expiresAt: '',
};

export const normalizeCustomerNotice = (notice) => {
  const data = notice || {};

  return {
    ...DEFAULT_CUSTOMER_NOTICE,
    ...data,
    message: data.message || '',
    expiresAt: data.expiresAt || '',
  };
};

export const isCustomerNoticeVisible = (notice, now = new Date()) => {
  const normalized = normalizeCustomerNotice(notice);
  if (!normalized.enabled) return false;
  if (!normalized.message.trim()) return false;
  if (!normalized.expiresAt) return true;

  const expiresAt = new Date(normalized.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) return false;

  return expiresAt >= now;
};
