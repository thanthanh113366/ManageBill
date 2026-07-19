export const PAYMENT_QR_OPTIONS = [
  { id: 'qr1', name: 'QR Trân', path: '/my_qr_1.jpg' },
  { id: 'qr2', name: 'QR Trúc', path: '/my_qr_2.jpg' },
  { id: 'qr3', name: 'QR 3', path: '/my_qr_3.jpg' },
];

export const DEFAULT_PAYMENT_QR = '/my_qr_3.jpg';
export const PAYMENT_QR_SETTINGS_COLLECTION = 'appSettings';
export const PAYMENT_QR_SETTINGS_DOC = 'paymentQR';

export const isValidPaymentQRPath = (path) =>
  PAYMENT_QR_OPTIONS.some((option) => option.path === path);
