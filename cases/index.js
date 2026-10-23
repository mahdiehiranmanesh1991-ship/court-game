// فهرست پرونده‌ها. برای افزودن پرونده‌ی تازه، فایلش را بسازید و این‌جا import کنید (راهنما: CASES.md).
import cheque from './cheque.js';
import land from './land.js';
import theft from './theft.js';
export const CASES = [cheque, land, theft].sort((a, b) => a.order - b.order);
export const caseById = (id) => CASES.find((c) => c.id === id);
