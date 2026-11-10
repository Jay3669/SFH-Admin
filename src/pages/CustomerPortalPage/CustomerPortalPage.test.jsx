import { fireEvent, render, screen } from "@testing-library/react";
import CustomerPortalPage from "./CustomerPortalPage";
import { loadPublicOrder, submitPublicOrder } from "../../services/featureServices";

jest.mock("../../services/featureServices", () => ({
  loadPublicOrder: jest.fn(),
  loadPublicReceipt: jest.fn(),
  submitPublicFeedback: jest.fn(),
  submitPublicOrder: jest.fn(),
}));

beforeEach(() => {
  window.history.replaceState({}, "", "/customer/order?token=encrypted-table-token");
  loadPublicOrder.mockResolvedValue({
    tableName: "Table 4",
    categories: [{ category_id: "1", category_name: "Mains" }],
    items: [{
      id: "12",
      name: "Paneer Biryani",
      description: "Basmati rice and paneer",
      price: 240,
      imageUrl: "",
      foodType: "Veg",
      categoryId: "1",
      categoryName: "Mains",
    }],
  });
  submitPublicOrder.mockResolvedValue({ message: "Order sent to the kitchen.", orderNumber: "KOT-000012" });
});

test("customers submit table orders through the public QR route", async () => {
  render(<CustomerPortalPage />);
  expect(await screen.findByRole("heading", { name: /order for table 4/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /add one paneer biryani/i }));
  fireEvent.click(screen.getByRole("button", { name: /place order/i }));

  expect(await screen.findByText(/order sent to the kitchen/i)).toBeInTheDocument();
  expect(submitPublicOrder).toHaveBeenCalledWith(
    "encrypted-table-token",
    [{ menuItemId: "12", quantity: 1 }],
    expect.any(String),
  );
});
