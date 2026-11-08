import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import ApiErrorSnackbar from './components/ApiLoader/ApiErrorSnackbar';
import InventoryPage from './pages/InventoryPage/InventoryPage';
import MenuManagementPage from './pages/MenuManagementPage/MenuManagementPage';
import { apiRequest } from './services/apiService';
import { listMenuItems } from './services/menuService';
import { getApiLoadingSnapshot } from './utils/apiLoadingStore';
import {
  dismissApiError,
  getApiErrorsSnapshot,
} from './utils/apiErrorStore';
import {
  getSessionExpirySnapshot,
  resetSessionExpiry,
} from './utils/sessionExpiryStore';

beforeEach(() => {
  while (getApiErrorsSnapshot().length) dismissApiError();
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetSessionExpiry();
  window.history.replaceState({}, '', '/');
});

afterEach(() => {
  jest.useRealTimers();
});

test('renders the admin sign-in screen', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^sign in$/i })).toBeDisabled();
});

test('admin login opens the dashboard with Dashboard active', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: async () =>
      JSON.stringify({
        success: true,
        message: 'Authentication successful.',
        token: 'test-token',
        data: {
          first_name: 'Test',
          last_name: 'Admin',
          email: 'admin@example.com',
          phone_number: '9000000000',
          role: 'Admin',
        },
      }),
  });
  render(<App />);
  fireEvent.change(screen.getByLabelText(/email or mobile number/i), {
    target: { value: '9000000000' },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: 'secret' },
  });
  fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

  expect(await screen.findByText(/good to see you, test/i)).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(
    new URL('/api/auth/login', 'http://localhost:5050'),
    expect.objectContaining({
      body: JSON.stringify({ identifier: '9000000000', password: 'secret' }),
    })
  );
  expect(screen.getByRole('button', { name: /dashboard/i })).toHaveClass('is-active');
  expect(window.location.pathname).toBe('/admin/dashboard');
});

test('non-admin login is rejected', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: async () =>
      JSON.stringify({
        success: true,
        token: 'manager-token',
        data: { first_name: 'Manager', role: 'Manager' },
      }),
  });
  render(<App />);
  fireEvent.change(screen.getByLabelText(/email or mobile number/i), {
    target: { value: 'manager@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: 'secret' },
  });
  fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

  expect(
    await screen.findByText(/does not have admin portal access/i)
  ).toBeInTheDocument();
  await waitFor(() => expect(window.location.pathname).toBe('/sfh/login'));
});

test('401 responses show one locked session dialog and login clears auth state', async () => {
  window.localStorage.setItem('sfhAdminUser', JSON.stringify({
    name: 'Test Admin',
    role: 'admin',
  }));
  window.localStorage.setItem('authToken', 'expired-access-token');
  window.localStorage.setItem('refreshToken', 'expired-refresh-token');
  window.sessionStorage.setItem('authSession', 'expired-session');
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    text: async () => JSON.stringify({ message: 'Unauthorized' }),
  });

  render(<App />);
  let protectedRequests;
  await act(async () => {
    protectedRequests = await Promise.allSettled([
      apiRequest('/api/protected', { skipGlobalLoader: true }),
      apiRequest('/api/another-protected-resource', { skipGlobalLoader: true }),
    ]);
  });
  expect(protectedRequests).toHaveLength(2);
  expect(global.fetch).toHaveBeenCalledTimes(2);

  const dialog = await screen.findByRole('dialog', { name: /session expired/i });
  expect(screen.getAllByRole('dialog', { name: /session expired/i })).toHaveLength(1);
  expect(screen.getByText('Your session has expired. Please log in again to continue.')).toBeInTheDocument();
  expect(within(dialog).getAllByRole('button')).toHaveLength(1);
  expect(getApiErrorsSnapshot()).toHaveLength(0);

  fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
  fireEvent.click(document.querySelector('.MuiBackdrop-root'));
  expect(screen.getByRole('dialog', { name: /session expired/i })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /^login$/i }));
  expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/sfh/login');
  expect(window.localStorage.getItem('sfhAdminUser')).toBeNull();
  expect(window.localStorage.getItem('authToken')).toBeNull();
  expect(window.localStorage.getItem('refreshToken')).toBeNull();
  expect(window.sessionStorage.getItem('authSession')).toBeNull();

  window.history.pushState({}, '', '/admin/menu');
  act(() => window.dispatchEvent(new PopStateEvent('popstate')));
  await waitFor(() => expect(window.location.pathname).toBe('/sfh/login'));
});

test('401 responses from authentication endpoints do not open the session dialog', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    text: async () => JSON.stringify({ message: 'Invalid credentials.' }),
  });

  await expect(apiRequest('/api/auth/login', {
    method: 'POST',
    skipGlobalLoader: true,
    skipGlobalError: true,
  })).rejects.toThrow('Invalid credentials.');
  expect(getSessionExpirySnapshot()).toBe(false);
});

test('admin can navigate to Menu Management and return to Dashboard', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: async () =>
      JSON.stringify({
        success: true,
        token: 'test-token',
        data: { first_name: 'Test', role: 'Admin' },
      }),
  });
  render(<App />);
  fireEvent.change(screen.getByLabelText(/email or mobile number/i), {
    target: { value: '9000000000' },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: 'secret' },
  });
  fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

  const menuNavigation = await screen.findByRole('button', {
    name: /menu management/i,
  });
  fireEvent.click(menuNavigation);

  expect(
    await screen.findByRole('heading', { level: 1, name: /menu management/i })
  ).toBeInTheDocument();
  expect(menuNavigation).toHaveClass('is-active');
  expect(window.location.pathname).toBe('/admin/menu');

  const inventoryNavigation = screen.getByRole('button', {
    name: /inventory & stock/i,
  });
  fireEvent.click(inventoryNavigation);
  expect(
    await screen.findByRole('heading', { level: 1, name: /inventory & stock/i })
  ).toBeInTheDocument();
  expect(inventoryNavigation).toHaveClass('is-active');
  expect(window.location.pathname).toBe('/admin/inventory');
  expect(screen.getByRole('table', { name: /inventory stock items/i })).toBeInTheDocument();
  expect(screen.getByText('Basmati rice')).toBeInTheDocument();
  expect(screen.getByText('Running low')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /dashboard/i }));
  expect(await screen.findByText(/good to see you, test/i)).toBeInTheDocument();
  expect(window.location.pathname).toBe('/admin/dashboard');
}, 15000);

test('admin can open the notifications inbox from its route', () => {
  window.localStorage.setItem('sfhAdminUser', JSON.stringify({
    name: 'Test Admin',
    role: 'admin',
  }));
  window.history.replaceState({}, '', '/admin/notifications');

  render(<App />);

  expect(screen.getByRole('heading', { level: 1, name: /notifications/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^notifications$/i })).toHaveClass('is-active');
  expect(window.location.pathname).toBe('/admin/notifications');
});

test('admin can open the Financial Health report from its route', async () => {
  window.localStorage.setItem('sfhAdminUser', JSON.stringify({
    name: 'Test Admin',
    role: 'admin',
  }));
  window.history.replaceState({}, '', '/admin/financial-health');
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: async () => JSON.stringify({
      report: {
        period: 'monthly',
        from: '2026-11-01',
        to: '2026-11-07',
        purchases: { count: 0, total: 0, bills: [] },
        sales: { count: 0, total: 0, bills: [] },
      },
    }),
  });

  render(<App />);

  expect(screen.getByRole('heading', { level: 1, name: /profit & loss/i })).toBeInTheDocument();
  await screen.findByRole('heading', { name: /income statement/i });
  expect(screen.getByRole('button', { name: /^financial health$/i })).toHaveClass('is-active');
  expect(window.location.pathname).toBe('/admin/financial-health');
});

test('admin can open staff management from its route', async () => {
  window.localStorage.setItem('sfhAdminUser', JSON.stringify({
    name: 'Test Admin',
    role: 'admin',
  }));
  window.history.replaceState({}, '', '/admin/staff');
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: async () => JSON.stringify({
      report: {
        period: 'daily',
        from: '2026-11-07',
        to: '2026-11-07',
        purchases: { count: 0, total: 0, bills: [] },
        sales: { count: 0, total: 0, bills: [] },
      },
    }),
  });

  render(<App />);

  expect(screen.getByRole('heading', { level: 1, name: /staff management/i })).toBeInTheDocument();
  expect(await screen.findByText(/build your restaurant team/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /staff management/i })).toHaveClass('is-active');
  expect(window.location.pathname).toBe('/admin/staff');
});

test('admin can open customer management from its route', async () => {
  window.localStorage.setItem('sfhAdminUser', JSON.stringify({
    name: 'Test Admin',
    role: 'admin',
  }));
  window.history.replaceState({}, '', '/admin/customers');

  render(<App />);

  expect(screen.getByRole('heading', { level: 1, name: /customer management/i })).toBeInTheDocument();
  expect(await screen.findByText(/your guest list starts here/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /customer management/i })).toHaveClass('is-active');
  expect(window.location.pathname).toBe('/admin/customers');
});

test('admin can open the daily cash drawer from its route', async () => {
  window.localStorage.setItem('sfhAdminUser', JSON.stringify({
    name: 'Test Admin',
    role: 'admin',
  }));
  window.history.replaceState({}, '', '/admin/cash-drawer');
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: async () => JSON.stringify({
      report: {
        period: 'daily',
        from: '2026-11-07',
        to: '2026-11-07',
        purchases: { count: 0, total: 0, bills: [] },
        sales: { count: 0, total: 0, bills: [] },
      },
    }),
  });

  render(<App />);

  expect(screen.getByRole('heading', { level: 1, name: /daily opening cash/i })).toBeInTheDocument();
  expect(await screen.findByText('Not opened')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /daily opening cash/i })).toHaveClass('is-active');
  expect(window.location.pathname).toBe('/admin/cash-drawer');
});

test('inventory supports creating items and recording stock adjustments', async () => {
  render(<InventoryPage />);
  fireEvent.click(screen.getByRole('button', { name: /add inventory item/i }));
  fireEvent.change(screen.getByLabelText(/item name/i), {
    target: { value: 'Test flour' },
  });
  const inventoryDialog = screen.getByRole('dialog');
  fireEvent.change(within(inventoryDialog).getByRole('textbox', { name: /^category$/i }), {
    target: { value: 'Pantry' },
  });
  fireEvent.change(within(inventoryDialog).getByRole('textbox', { name: /^unit$/i }), {
    target: { value: 'kg' },
  });
  fireEvent.change(screen.getByLabelText(/current quantity/i), {
    target: { value: '4' },
  });
  fireEvent.change(screen.getByLabelText(/low-stock threshold/i), {
    target: { value: '2' },
  });
  fireEvent.submit(inventoryDialog.querySelector('form'));
  expect(await screen.findByText('Test flour')).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: /receive test flour/i }));
  fireEvent.change(screen.getByLabelText(/quantity \(kg\)/i), {
    target: { value: '3' },
  });
  fireEvent.submit(screen.getByRole('dialog').querySelector('form'));
  expect(await screen.findByText('Stock adjustment recorded.')).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(within(screen.getByRole('row', { name: /test flour/i })).getByText('7 kg')).toBeInTheDocument();
}, 15000);

test('menu management supports category and menu item management', async () => {
  window.localStorage.setItem('authToken', 'admin-test-token');
  let categories = [
    {
      category_id: '9',
      category_name: 'Main Course1',
      description: 'Main course items',
      display_order: 1,
      is_active: true,
    },
    {
      category_id: '10',
      category_name: 'Main Course2',
      description: 'More main course items',
      display_order: 2,
      is_active: true,
    },
  ];
  let items = [
    {
      menu_item_id: '1',
      category_id: '9',
      name: 'Existing dish',
      description: 'A sample item',
      price: '200.00',
      is_available: true,
      image_url: null,
      food_type: 'Non-Veg',
    },
  ];
  let nextCategoryId = 11;
  let nextItemId = 2;
  const respond = (data, ok = true) => ({
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Internal Server Error',
    text: async () => JSON.stringify(data),
  });
  global.fetch = jest.fn(async (requestUrl, options = {}) => {
    const url = new URL(requestUrl);
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : {};
    const parts = url.pathname.split('/').filter(Boolean);
    const collection = `/${parts.slice(0, 2).join('/')}`;
    const id = parts[2];

    if (collection === '/api/menu-categories') {
      if (method === 'GET' && !id) {
        if (url.searchParams.get('page') === '2') {
          return respond({ success: true, categories: categories.slice(1, 2) });
        }
        return respond({
          success: true,
          categories: categories.slice(0, 1),
          pagination: { page: 1, limit: 1, total: categories.length, pages: 2 },
        });
      }
      if (method === 'GET') {
        return respond({
          success: true,
          category: categories.find((category) => category.category_id === id),
        });
      }
      if (method === 'POST') {
        const category = {
          category_id: String(nextCategoryId++),
          ...body,
        };
        categories.push(category);
        return respond({ success: true, category });
      }
      if (method === 'PUT') {
        categories = categories.map((category) =>
          category.category_id === id ? { ...category, ...body } : category
        );
        return respond({
          success: true,
          category: categories.find((category) => category.category_id === id),
        });
      }
      if (method === 'DELETE') {
        categories = categories.filter((category) => category.category_id !== id);
        return respond({ success: true, message: 'Category deleted.' });
      }
    }

    if (collection === '/api/menu-items') {
      if (method === 'GET' && !id) {
        return respond({
          success: true,
          items,
          pagination: { page: 1, limit: 20, total: items.length, pages: 1 },
        });
      }
      if (method === 'GET') {
        return respond({
          success: true,
          item: items.find((item) => item.menu_item_id === id),
        });
      }
      if (method === 'POST') {
        const item = {
          menu_item_id: String(nextItemId++),
          ...body,
          is_available: body.is_available !== false,
          category: {
            category_id: body.category_id,
            category_name: categories.find(
              (category) => category.category_id === body.category_id
            )?.category_name,
          },
        };
        items.push(item);
        return respond({ success: true, item });
      }
      if (method === 'PUT') {
        items = items.map((item) =>
          item.menu_item_id === id ? { ...item, ...body } : item
        );
        return respond({
          success: true,
          item: items.find((item) => item.menu_item_id === id),
        });
      }
      if (method === 'DELETE') {
        items = items.filter((item) => item.menu_item_id !== id);
        return respond({ success: true, message: 'Menu item deleted.' });
      }
    }

    return respond({ success: false, message: 'Unexpected API request.' }, false);
  });

  render(<MenuManagementPage />);
  expect(await screen.findByRole('heading', { name: 'Existing dish' })).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(
    expect.any(URL),
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer expired-access-token',
      }),
    })
  );

  fireEvent.click(screen.getByRole('tab', { name: /categories/i }));
  fireEvent.click(screen.getByRole('button', { name: /add category/i }));
  fireEvent.change(screen.getByLabelText(/category name/i), {
    target: { value: 'soups' },
  });
  fireEvent.change(screen.getByLabelText(/^description$/i), {
    target: { value: 'main course dishes' },
  });
  expect(screen.getByLabelText(/category name/i)).toHaveValue('Soups');
  expect(screen.getByLabelText(/^description$/i)).toHaveValue('Main course dishes');
  fireEvent.click(screen.getByRole('button', { name: /create category/i }));
  expect(await screen.findByText('Soups')).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('tab', { name: /categories/i })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('Category created.')).toBeInTheDocument();
  const createCategoryRequest = global.fetch.mock.calls.find(
    ([url, options]) =>
      new URL(url).pathname === '/api/menu-categories' &&
      options.method === 'POST'
  );
  expect(JSON.parse(createCategoryRequest[1].body)).toEqual({
    category_name: 'Soups',
    description: 'Main course dishes',
    display_order: 3,
    is_active: true,
  });

  fireEvent.click(
    await screen.findByRole('button', { name: /view items in soups/i })
  );
  expect(
    await screen.findByText(/no menu items in this category/i)
  ).toBeInTheDocument();

  fireEvent.click(await screen.findByRole('tab', { name: /categories/i }));
  fireEvent.click(screen.getByRole('button', { name: /edit soups/i }));
  fireEvent.change(await screen.findByLabelText(/category name/i), {
    target: { value: 'Soups & Salads' },
  });
  fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
  expect(await screen.findByText('Soups & Salads')).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(global.fetch.mock.calls.some(
    ([url, options]) =>
      new URL(url).pathname === '/api/menu-categories/11' &&
      options.method === 'PUT'
  )).toBe(true);

  fireEvent.click(
    screen.getByRole('button', { name: /delete soups & salads/i })
  );
  fireEvent.click(screen.getByRole('button', { name: /delete category/i }));
  await waitFor(() => {
    expect(screen.queryByText('Soups & Salads')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  expect(screen.getByText('Category deleted.')).toBeInTheDocument();

  fireEvent.click(await screen.findByRole('tab', { name: /menu items/i }));
  fireEvent.click(screen.getByText('Add menu item'));
  fireEvent.change(screen.getByLabelText(/item name/i), {
    target: { value: 'tomato soup' },
  });
  fireEvent.change(screen.getByLabelText(/^description$/i), {
    target: { value: 'fresh tomato soup' },
  });
  expect(screen.getByLabelText(/item name/i)).toHaveValue('Tomato soup');
  expect(screen.getByLabelText(/^description$/i)).toHaveValue('Fresh tomato soup');
  fireEvent.change(screen.getByLabelText(/price/i), {
    target: { value: '160' },
  });
  fireEvent.change(screen.getByLabelText(/image url/i), {
    target: { value: 'https://example.test/tomato-soup.jpg' },
  });
  fireEvent.click(screen.getByRole('button', { name: /^add item$/i }));

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await screen.findByRole('heading', { name: 'Tomato soup' })).toBeInTheDocument();
  expect(screen.getByText('Menu item added.')).toBeInTheDocument();
  const createItemRequest = global.fetch.mock.calls.find(
    ([url, options]) =>
      new URL(url).pathname === '/api/menu-items' &&
      options.method === 'POST'
  );
  expect(JSON.parse(createItemRequest[1].body)).toEqual({
    category_id: '9',
    name: 'Tomato soup',
    description: 'Fresh tomato soup',
    price: '160',
    food_type: 'Veg',
    image_url: 'https://example.test/tomato-soup.jpg',
  });

  fireEvent.click(screen.getByRole('button', { name: /edit tomato soup/i }));
  const itemNameInput = await screen.findByLabelText(/item name/i);
  expect(itemNameInput).toHaveValue('Tomato soup');
  fireEvent.change(itemNameInput, {
    target: { value: 'Tomato Soup Special' },
  });
  fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await screen.findByRole('heading', { name: 'Tomato Soup Special' })).toBeInTheDocument();
  expect(global.fetch.mock.calls.some(
    ([url, options]) =>
      new URL(url).pathname === '/api/menu-items/2' &&
      options.method === 'PUT'
  )).toBe(true);

  fireEvent.click(
    screen.getByLabelText(/availability for tomato soup special/i)
  );
  await waitFor(() => {
    const availabilityUpdate = global.fetch.mock.calls.find(
      ([url, options]) =>
        new URL(url).pathname === '/api/menu-items/2' &&
        options.method === 'PUT' &&
        JSON.parse(options.body).is_available === false
    );
    expect(availabilityUpdate).toBeDefined();
  });

  fireEvent.click(screen.getByRole('button', { name: /delete tomato soup special/i }));
  fireEvent.click(screen.getByRole('button', { name: /delete item/i }));
  await waitFor(() => {
    expect(screen.queryByRole('heading', { name: 'Tomato Soup Special' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  }, { timeout: 5000 });

  const searchInput = screen.getByRole('textbox', { name: /search menu items/i });
  fireEvent.change(searchInput, { target: { value: 'as' } });
  expect(screen.getByRole('combobox', { name: /food type/i })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: /availability/i })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: /sort by/i })).toBeInTheDocument();
  await waitFor(() => {
    const filteredRequest = global.fetch.mock.calls.find(([url]) => {
      const requestUrl = new URL(url);
      return requestUrl.pathname === '/api/menu-items' &&
        requestUrl.searchParams.get('search') === 'as';
    });
    expect(filteredRequest).toBeDefined();
  });
}, 30000);

test('menu management displays API load failures and offers retry', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 503,
    statusText: 'Service Unavailable',
    text: async () => JSON.stringify({ message: 'Menu service is unavailable.' }),
  });

  render(
    <>
      <MenuManagementPage />
      <ApiErrorSnackbar />
    </>
  );

  expect(await screen.findByText('Menu service is unavailable.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
});

test('menu content renders when effects run twice in StrictMode', async () => {
  global.fetch = jest.fn(async (requestUrl) => {
    const url = new URL(requestUrl);
    const data = url.pathname.endsWith('/menu-categories')
      ? {
          success: true,
          categories: [{
            category_id: '1',
            category_name: 'Breakfast',
            is_active: true,
          }],
          pagination: { page: 1, limit: 20, pages: 1 },
        }
      : {
          success: true,
          items: [{
            menu_item_id: '1',
            category_id: '1',
            name: 'Idli',
            description: 'Steamed rice cakes',
            price: '60',
            is_available: true,
            food_type: 'Veg',
          }],
          pagination: { page: 1, limit: 20, pages: 1 },
        };
    return {
      ok: true,
      statusText: 'OK',
      text: async () => JSON.stringify(data),
    };
  });

  render(
    <StrictMode>
      <MenuManagementPage />
    </StrictMode>
  );

  expect(await screen.findByRole('heading', { name: 'Idli' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /categories \(1\)/i })).toBeInTheDocument();
});

test('global API loader tracks concurrent requests and excludes authentication requests', async () => {
  const pendingRequests = [];
  global.fetch = jest.fn(
    () => new Promise((resolve) => pendingRequests.push(resolve))
  );
  const response = {
    ok: true,
    statusText: 'OK',
    text: async () => JSON.stringify({ success: true }),
  };

  const firstRequest = apiRequest('/api/first');
  const secondRequest = apiRequest('/api/second', { method: 'PATCH' });
  expect(getApiLoadingSnapshot()).toBe(true);

  pendingRequests[0](response);
  await firstRequest;
  expect(getApiLoadingSnapshot()).toBe(true);

  pendingRequests[1](response);
  await secondRequest;
  expect(getApiLoadingSnapshot()).toBe(true);
  await new Promise((resolve) => setTimeout(resolve, 3100));
  expect(getApiLoadingSnapshot()).toBe(false);
  expect(global.fetch.mock.calls[1][1].method).toBe('PATCH');

  const authRequest = apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: 'admin', password: 'secret' }),
    skipGlobalLoader: true,
    skipGlobalError: true,
  });
  expect(getApiLoadingSnapshot()).toBe(false);
  pendingRequests[2](response);
  await authRequest;
  expect(getApiLoadingSnapshot()).toBe(false);
});

test('global API loader keeps responses immediate and enforces the minimum on failures', async () => {
  jest.useFakeTimers();
  let resolveSlowRequest;
  global.fetch = jest.fn()
    .mockImplementationOnce(
      () => new Promise((resolve) => { resolveSlowRequest = resolve; })
    )
    .mockResolvedValueOnce({
      ok: false,
      statusText: 'Service Unavailable',
      text: async () => JSON.stringify({ message: 'Request failed.' }),
    });

  const slowRequest = apiRequest('/api/slow');
  jest.advanceTimersByTime(4000);
  expect(getApiLoadingSnapshot()).toBe(true);
  resolveSlowRequest({
    ok: true,
    statusText: 'OK',
    text: async () => JSON.stringify({ success: true, value: 'ready' }),
  });
  await expect(slowRequest).resolves.toEqual({ success: true, value: 'ready' });
  expect(getApiLoadingSnapshot()).toBe(false);

  const failedRequest = apiRequest('/api/failure');
  await expect(failedRequest).rejects.toThrow('Request failed.');
  expect(getApiLoadingSnapshot()).toBe(true);
  jest.advanceTimersByTime(2999);
  expect(getApiLoadingSnapshot()).toBe(true);
  jest.advanceTimersByTime(1);
  expect(getApiLoadingSnapshot()).toBe(false);
  jest.useRealTimers();
});

test('menu item listing sends filters and preserves them across pagination', async () => {
  jest.useFakeTimers();
  global.fetch = jest.fn()
    .mockResolvedValueOnce({
      ok: true,
      statusText: 'OK',
      text: async () => JSON.stringify({
        success: true,
        items: [{ menu_item_id: '1' }],
        pagination: { page: 1, limit: 1, pages: 2 },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      statusText: 'OK',
      text: async () => JSON.stringify({
        success: true,
        items: [{ menu_item_id: '2' }],
        pagination: { page: 2, limit: 1, pages: 2 },
      }),
    });

  const items = await listMenuItems({
    search: 'as',
    foodType: 'nonveg',
    isAvailable: 'true',
    sort: 'price_asc',
  });
  expect(items).toHaveLength(2);
  const firstUrl = new URL(global.fetch.mock.calls[0][0]);
  const secondUrl = new URL(global.fetch.mock.calls[1][0]);
  [firstUrl, secondUrl].forEach((url) => {
    expect(url.searchParams.get('search')).toBe('as');
    expect(url.searchParams.get('food_type')).toBe('nonveg');
    expect(url.searchParams.get('is_available')).toBe('true');
    expect(url.searchParams.get('sort')).toBe('price_asc');
  });
  expect(secondUrl.searchParams.get('page')).toBe('2');
  expect(secondUrl.searchParams.get('limit')).toBe('1');
  jest.runOnlyPendingTimers();
});
