import React from 'react';
import { Link } from 'react-router-dom';
import { useFinance } from '../../context/FinanceContext';
import { FaBullseye,FaWallet,FaArrowUp,FaArrowDown,FaPlus,FaMinus,FaChartLine,FaCalendarAlt,FaMoon,FaSun,FaSignOutAlt} from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';


// Har din ka total (khaali din = 0), purane se naye
const dailyTotals = (transactions, days) => {
  const byDay = {};
  transactions.forEach((t) => {
    const k = new Date(t.date).toISOString().slice(0, 10);
    byDay[k] = (byDay[k] || 0) + t.amount;
  });
  const now = new Date();
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(todayUTC - i * 86400000);
    out.push({
      date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
      amount: byDay[d.toISOString().slice(0, 10)] || 0,
    });
  }
  return out;
};

const Home = () => {
  const { dashboardData, theme, toggleTheme, logout, user } = useFinance();

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const {
    totalBalance,
    totalIncome,
    totalExpense,
    last30daysExpenses,
    last60daysIncome,
    recentTransaction
  } = dashboardData;

  // Prepare chart data
  const incomeData = dailyTotals(last60daysIncome.transactions, 60);

  const expenseData = dailyTotals(last30daysExpenses.transactions, 30);

  // Category spending data for pie chart
  const categoryData = recentTransaction
    .filter(t => t.type === 'expense')
    .reduce((acc, transaction) => {
      const existing = acc.find(item => item.category === transaction.category);
      if (existing) {
        existing.value += transaction.amount;
      } else {
        acc.push({ category: transaction.category, value: transaction.amount });
      }
      return acc;
    }, []);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900`}>
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Welcome back, {user?.name || 'User'}!
                </h1>
                <p className="text-gray-600 dark:text-gray-300 mt-1">
                  Here's your financial overview
                </p>
              </div>
              {/* Removed quick action tabs here, no empty div needed */}
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleTheme}
                className="p-3 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-200"
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
              >
                {theme === 'light' ? <FaMoon /> : <FaSun className="text-yellow-500" />}
              </button>
              <button
                onClick={logout}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all duration-200"
              >
                <FaSignOutAlt className="mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-300 text-sm font-medium">Total Balance</p>
                <p className={`text-3xl font-bold ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${totalBalance.toFixed(2)}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                <FaWallet className="text-blue-600 text-xl" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-300 text-sm font-medium">Total Income</p>
                <p className="text-3xl font-bold text-green-600">${totalIncome.toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <FaArrowUp className="text-green-600 text-xl" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-300 text-sm font-medium">Total Expenses</p>
                <p className="text-3xl font-bold text-red-600">${totalExpense.toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                <FaArrowDown className="text-red-600 text-xl" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Link
            to="/income"
            className="bg-green-600 text-white rounded-xl p-4 shadow-lg border border-green-700 hover:bg-green-700 transition-all duration-200 group"
          >
            <div className="flex items-center">
              <div className="w-10 h-10 bg-green-800 rounded-lg flex items-center justify-center mr-3 group-hover:bg-green-900 transition-colors duration-200">
                <FaPlus className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Add Income</h3>
                <p className="text-sm text-green-200">Track earnings</p>
              </div>
            </div>
          </Link>
  
          <Link
            to="/expense"
            className="bg-red-600 text-white rounded-xl p-4 shadow-lg border border-red-700 hover:bg-red-700 transition-all duration-200 group"
          >
            <div className="flex items-center">
              <div className="w-10 h-10 bg-red-800 rounded-lg flex items-center justify-center mr-3 group-hover:bg-red-900 transition-colors duration-200">
                <FaMinus className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Add Expense</h3>
                <p className="text-sm text-red-200">Record spending</p>
              </div>
            </div>
          </Link>
  
          <Link
            to="/budgets"
            className="bg-blue-600 text-white rounded-xl p-4 shadow-lg border border-blue-700 hover:bg-blue-700 transition-all duration-200 group"
          >
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-800 rounded-lg flex items-center justify-center mr-3 group-hover:bg-blue-900 transition-colors duration-200">
                <FaChartLine className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Set Budget</h3>
                <p className="text-sm text-blue-200">Control spending</p>
              </div>
            </div>
          </Link>
  
          <Link
            to="/reports"
            className="bg-purple-600 text-white rounded-xl p-4 shadow-lg border border-purple-700 hover:bg-purple-700 transition-all duration-200 group"
          >
            <div className="flex items-center">
              <div className="w-10 h-10 bg-purple-800 rounded-lg flex items-center justify-center mr-3 group-hover:bg-purple-900 transition-colors duration-200">
                <FaCalendarAlt className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">View Reports</h3>
                <p className="text-sm text-purple-200">Analyze data</p>
              </div>
            </div>
          </Link>

           <Link
            to="/goals"
            className="bg-orange-600 text-white rounded-xl p-4 shadow-lg border border-orange-700 hover:bg-orange-700 transition-all duration-200 group"
          >
            <div className="flex items-center">
              <div className="w-10 h-10 bg-orange-800 rounded-lg flex items-center justify-center mr-3 group-hover:bg-orange-900 transition-colors duration-200">
                <FaBullseye className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">View Goals</h3>
                <p className="text-sm text-orange-200">Track progress</p>
              </div>
            </div>
          </Link>
        </div>
        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Income Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700 overflow-x-auto">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Income (Last 60 Days)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={incomeData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" minTickGap={24} />
                <YAxis />
                <Tooltip formatter={(value) => [`$${value}`, 'Income']} />
                <Bar dataKey="amount" fill="green" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Expense Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Expenses (Last 30 Days)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={expenseData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" minTickGap={24} />
                <YAxis />
                <Tooltip formatter={(value) => [`$${value}`, 'Expense']} />
                <Bar dataKey="amount" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown and Recent Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Category Breakdown */}
          {categoryData.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Spending by Category</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`$${value}`, 'Amount']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Recent Transactions */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Recent Transactions</h3>
              <p className="text-gray-600 dark:text-gray-300 mt-1">Your latest financial activity</p>
            </div>

            {recentTransaction.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-96 overflow-y-auto">
                {recentTransaction.slice(0, 10).map((transaction, index) => (
                  <div key={transaction._id || transaction.id || index} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                          transaction.type === 'income' ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'
                        }`}>
                          {transaction.type === 'income' ? (
                            <FaArrowUp className="text-green-600" />
                          ) : (
                            <FaArrowDown className="text-red-600" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white">{transaction.title}</h4>
                          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              transaction.type === 'income'
                                ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                                : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                            }`}>
                              {transaction.type}
                            </span>
                            {transaction.category && (
                              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                {transaction.category}
                              </span>
                            )}
                            <span>{new Date(transaction.date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <span className={`text-lg font-bold ${
                        transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'}${transaction.amount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <FaCalendarAlt className="text-gray-300 dark:text-gray-600 text-4xl mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">No Transactions Yet</h3>
                <p className="text-gray-500 dark:text-gray-500">Start adding income and expenses to see your transaction history</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;