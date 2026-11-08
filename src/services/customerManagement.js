const STORAGE_KEY = "sfhCustomerManagement";

function isValidCustomer(customer) {
  return Boolean(
    customer &&
    typeof customer.id === "string" &&
    customer.id.trim() &&
    typeof customer.name === "string" &&
    customer.name.trim() &&
    typeof customer.phone === "string" &&
    customer.phone.trim() &&
    typeof customer.email === "string" &&
    Number.isFinite(Number(customer.visits)) &&
    Number(customer.visits) >= 0 &&
    Number.isFinite(Number(customer.spend)) &&
    Number(customer.spend) >= 0 &&
    typeof customer.joinedAt === "string"
  );
}

export function getCustomers() {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return [];
  let customers;
  try {
    customers = JSON.parse(saved);
  } catch {
    throw new Error("Saved customer data could not be read. Clear the damaged customer data or contact support.");
  }
  if (!Array.isArray(customers) || !customers.every(isValidCustomer)) {
    throw new Error("Saved customer data is invalid. Clear the damaged customer data or contact support.");
  }
  return customers;
}

export function saveCustomers(customers) {
  if (!Array.isArray(customers) || !customers.every(isValidCustomer)) {
    throw new Error("Customer records are invalid and could not be saved.");
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
}
