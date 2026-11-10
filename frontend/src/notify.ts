/** Cross-page badge / list refresh signals (AppLayout listens for these). */

export function notifyLoansChanged() {
  window.dispatchEvent(new Event('ml:loans-changed'))
  window.dispatchEvent(new Event('ml:activity-changed'))
}

export function notifyApprovalsChanged() {
  window.dispatchEvent(new Event('ml:approvals-changed'))
  window.dispatchEvent(new Event('ml:activity-changed'))
}

export function notifyPaymentSchedulesChanged() {
  window.dispatchEvent(new Event('ml:payment-schedules-changed'))
}

export function notifyActivityChanged() {
  window.dispatchEvent(new Event('ml:activity-changed'))
}
