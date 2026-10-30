type BookingPrefill = {
  service: string;
  packageName: string;
};

const emptyPrefill: BookingPrefill = { service: '', packageName: '' };

let current: BookingPrefill = emptyPrefill;
const listeners = new Set<() => void>();

export function subscribeBookingPrefill(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getBookingPrefill() {
  return current;
}

export function getServerBookingPrefill() {
  return emptyPrefill;
}

export function publishBookingPrefill(value: BookingPrefill) {
  if (current.service === value.service && current.packageName === value.packageName) return;
  current = value;
  listeners.forEach((listener) => listener());
}
