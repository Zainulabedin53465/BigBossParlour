import { business } from '../config/business.js';

export function telUrl() {
  return `tel:${business.phoneE164}`;
}

// Opens WhatsApp with a message the customer can edit and send. It does NOT confirm a booking.
export function whatsappUrl(message = business.whatsappMessage) {
  return `https://wa.me/${business.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
