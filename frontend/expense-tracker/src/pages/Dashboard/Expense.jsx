import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFinance } from '../../context/FinanceContext'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { FaPlus, FaTrash, FaArrowLeft, FaCalendarAlt, FaMoon, FaSun } from 'react-icons/fa'
import { toast } from 'react-hot-toast'


const Expense = () => {
  const { expenses, addExpense, deleteExpense, getTotalExpenses, budgets, theme, toggleTheme } = useFinance()
  const [showForm, setShowForm] = useState(false)
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    amount: '',
    category: 'Food',
    date: new Date().toISOString().split('T')[0]
  })

  const categories = ['Food', 'Transportation', 'Entertainment', 'Bills', 'Shopping', 'Healthcare', 'Education', 'Other']

  const handleChange = (e) => {
    setExpenseForm({
      ...expenseForm,[e.target.name]: e.target.value
})
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!expenseForm.title || !expenseForm.amount) {
      toast.error('Please fill in all fields')
      return
    }

    // Debug log for development
    console.log('Adding expense:', expenseForm)

    addExpense({
      title: expenseForm.title,
      amount: parseFloat(expenseForm.amount),
      category: expenseForm.category,
      date: expenseForm.date
    })

    toast.success('Expense added successfully!')
    setExpenseForm({
      title: '',
      amount: '',
      category: 'Food',
      date: new Date().toISOString().split('T')[0]
    })
    setShowForm(false)
  }

  const handleDelete = (id) => {
    deleteExpense(id)
    toast.success('Expense deleted successfully!')
  }

  // Prepare data for chart
  const categoryData = categories.map(category => ({
    name: category,
    value: expenses.filter(item => item.category === category).reduce((sum, item) => sum + item.amount, 0)
  })).filter(item => item.value > 0)

  const getProgressColor = (progress) => {
    if (progress >= 100) return 'bg-red-500'
    if (progress >= 80) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getProgressStatus = (progress) => {
    if (progress >= 100) return 'Over Budget'
    if (progress >= 80) return 'Near Limit'
    return 'On Track'
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900`}>
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Link
                to="/dashboard"
                className="mr-4 p-3 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-200"
              >
                <FaArrowLeft className="text-lg" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Expense Management</h1>
                <p className="text-gray-600 dark:text-gray-300 mt-1">Track and manage your daily expenses</p>
              </div>
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
                onClick={() => setShowForm(!showForm)}
                className="flex items-center px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-lg"
              >
                <FaPlus className="mr-2" />
                Add Expense
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-8 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Total Expenses</h3>
              <p className="text-4xl font-bold text-red-600">${getTotalExpenses().toFixed(2)}</p>
              <p className="text-gray-600 dark:text-gray-300 mt-1">{expenses.length} expense records</p>
            </div>
            <div className="text-right">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                <FaCalendarAlt className="text-red-600 text-2xl" />
              </div>
            </div>
          </div>
        </div>

        {/* Add Expense Form */}
        {showForm && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8 border border-gray-100 dark:border-gray-700">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Add New Expense</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="title" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Expense Title
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={expenseForm.title}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., Lunch at restaurant"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="amount" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Amount ($)
                  </label>
                  <input type="number" id="amount" name="amount" value={expenseForm.amount} onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="0.00"
                    step="0.01" min="0"  required />
                </div>

                <div>
                  <label htmlFor="category" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Category
                  </label>
                  <select id="category" name="category" value={expenseForm.category} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="date" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Date
                  </label>
                  <input type="date" id="date" name="date" value={expenseForm.date} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" required/>
                </div>
              </div>

              <div className="flex space-x-4">
                <button type="submit" className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-lg font-semibold"
>
                  Add Expense
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-8 py-3 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-400 dark:hover:bg-gray-500 transition-all duration-200 font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Budget Overview */}
        {Object.keys(budgets).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {Object.entries(budgets).map(([category, budget]) => {
              const spent = expenses.filter(exp => exp.category === category)
                .reduce((total, exp) => total + parseFloat(exp.amount), 0)
              const progress = (spent / budget) * 100

              return (
                <div key={category} className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white">{category}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      progress >= 100 ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400' :
                      progress >= 80 ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400' :
                      'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                    }`}>
                      {getProgressStatus(progress)}
                    </span>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300 mb-1">
                      <span>${spent.toFixed(2)} / ${budget.toFixed(2)}</span>
                      <span>{progress.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(progress)}`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Chart */}
        {categoryData.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-8 border border-gray-100 dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Expenses by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [`$${value.toFixed(2)}`, 'Amount']} />
                <Bar dataKey="value" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Expense List */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Your Expenses</h3>
            <p className="text-gray-600 dark:text-gray-300 mt-1">Manage and track all your expenses</p>
          </div>

          {expenses.length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {expenses.map((item) => (
                <div key={item._id || item.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-xl flex items-center justify-center mr-4">
                        <FaCalendarAlt className="text-red-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">{item.title}</h4>
                        <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg">{item.category}</span>
                          <span>{new Date(item.date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-xl font-bold text-red-600">-${item.amount.toFixed(2)}</span>
                      <button
                        onClick={() => handleDelete(item._id || item.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <FaCalendarAlt className="text-gray-300 dark:text-gray-600 text-6xl mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">No Expenses Yet</h3>
              <p className="text-gray-500 dark:text-gray-500 mb-6">Start tracking your expenses to better manage your finances</p>
              <button
                onClick={() => setShowForm(true)}
                className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-lg font-semibold"
              >
                Add Your First Expense
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Expense
