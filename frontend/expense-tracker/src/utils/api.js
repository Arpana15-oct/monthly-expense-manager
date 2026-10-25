import axios from 'axios';
import { API_PATHS } from './apiPaths';

// Axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const message = error.response.data?.message || `HTTP error! status: ${error.response.status}`;
      throw new Error(message);
    } else if (error.request) {
      throw new Error('Network error - please check if the server is running');
    } else {
      throw new Error(error.message || 'An unexpected error occurred');
    }
  }
);

// ---------- AUTH ----------
export const registerUser = (userData) => api.post('/auth/register', userData);
export const loginUser = (credentials) => api.post('/auth/login', credentials);
export const getUserInfo = () => api.get('/auth/getUser');

export const uploadImage = (formData) => {
  const token = localStorage.getItem('token');
  return axios.post(API_PATHS.UPLOAD_IMAGE, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
};

// ---------- DASHBOARD ----------
export const getDashboardData = () => api.get('/dashboard');

// ---------- INCOME ----------
export const addIncome = (incomeData) => api.post('/income/add', incomeData);
export const getAllIncome = () => api.get('/income/get');
export const deleteIncome = (id) => api.delete(`/income/${id}`);
export const downloadIncomeExcel = () => api.get('/income/downloadincomeexcel', { responseType: 'blob' });

// ---------- EXPENSE ----------
export const addExpense = (expenseData) => api.post('/expense/add', expenseData);
export const getAllExpense = () => api.get('/expense/get');
export const deleteExpense = (id) => api.delete(`/expense/${id}`);
export const downloadExpenseExcel = () => api.get('/expense/downloadexpenseexcel', { responseType: 'blob' });

// ---------- BUDGET ----------
export const addBudget = (budgetData) => api.post('/budget/add', budgetData);
export const getAllBudgets = () => api.get('/budget/get');
export const deleteBudget = (id) => api.delete(`/budget/${id}`);

export const getSuggestions = (refresh = false) =>
  api.get('/insights/suggestions', { params: refresh ? { refresh: 1 } : {} });

export const addGoal = (goalData) => api.post('/goal/add', goalData);
export const getAllGoals = () => api.get('/goal/get');
export const replanGoal = (id) => api.post(`/goal/${id}/replan`);
export const deleteGoal = (id) => api.delete(`/goal/${id}`);

export const sendBuddyMessage = (messages) => api.post('/buddy/chat', { messages });

export const scanReceipt = (file) => {
  const fd = new FormData();
  fd.append('receipt', file);
  return api.post('/buddy/receipt', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30000 });
};