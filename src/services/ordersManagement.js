const STORAGE_KEY = "sfhOrdersManagement";

const SAMPLE_ORDERS = [
  {
    id: "ORD-1048",
    customer: "Priya Sharma",
    phone: "9876543210",
    type: "Dine-in",
    table: "T-04",
    status: "Preparing",
    payment: "Paid",
    placedAt: "2026-11-07T12:42:00.000Z",
    items: [
      { name: "Paneer Butter Masala", quantity: 2, price: 240 },
      { name: "Butter Naan", quantity: 3, price: 55 },
      { name: "Masala Soda", quantity: 2, price: 80 },
    ],
    notes: "Less spicy. Serve naan separately.",
  },
  {
    id: "ORD-1047",
    customer: "Rahul Mehta",
    phone: "9812345670",
    type: "Takeaway",
    table: "",
    status: "Ready",
    payment: "Paid",
    placedAt: "2026-11-07T12:18:00.000Z",
    items: [
      { name: "Chicken Biryani", quantity: 2, price: 260 },
      { name: "Gulab Jamun", quantity: 4, price: 60 },
    ],
    notes: "",
  },
  {
    id: "ORD-1046",
    customer: "Ananya Iyer",
    phone: "9898989898",
    type: "Delivery",
    table: "",
    status: "Out for delivery",
    payment: "Online",
    placedAt: "2026-11-07T11:55:00.000Z",
    items: [
      { name: "Veg Fried Rice", quantity: 1, price: 190 },
      { name: "Manchurian Dry", quantity: 1, price: 220 },
    ],
    notes: "House 21, 2nd floor",
  },
  {
    id: "ORD-1045",
    customer: "Walk-in guest",
    phone: "",
    type: "Dine-in",
    table: "T-02",
    status: "Completed",
    payment: "Cash",
    placedAt: "2026-11-07T11:20:00.000Z",
    items: [
      { name: "South Indian Combo", quantity: 2, price: 180 },
      { name: "Filter Coffee", quantity: 2, price: 70 },
    ],
    notes: "",
  },
  {
    id: "ORD-1044",
    customer: "Vikram Singh",
    phone: "9988776655",
    type: "Takeaway",
    table: "",
    status: "Cancelled",
    payment: "Pending",
    placedAt: "2026-11-07T10:48:00.000Z",
    items: [
      { name: "Dal Tadka", quantity: 1, price: 180 },
      { name: "Jeera Rice", quantity: 1, price: 160 },
    ],
    notes: "Customer cancelled",
  },
];

export function getOrders() {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return SAMPLE_ORDERS.map((order) => ({ ...order, items: order.items.map((item) => ({ ...item })) }));
  try {
    const orders = JSON.parse(saved);
    if (!Array.isArray(orders)) throw new Error();
    return orders;
  } catch {
    throw new Error("Saved order data could not be read.");
  }
}

export function saveOrders(orders) {
  if (!Array.isArray(orders)) throw new Error("Orders could not be saved.");
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}
