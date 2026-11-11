import BookingSuccess from "./index";

/**
 * ServiceBooked — "Order Placed" confirmation page for services booked with
 * Cash on Service (COD / pay on service). Renders the shared BookingSuccess
 * component in COD mode so it shows "Order Placed!" instead of "Booking Confirmed!".
 */
export default function ServiceBooked() {
  return <BookingSuccess isCod />;
}
