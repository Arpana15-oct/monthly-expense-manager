const xlsx = require("xlsx");
const Income = require("../models/Income.js");

exports.addIncome = async (req, res) => {
  const userId = req.user.id;
  try {
    const { icon, source, amount, date, category } = req.body || {};

    if (!source || !amount) {
      return res.status(400).json({ message: "Please fill all required fields" });
    }

    const newIncome = new Income({
      userId,
      icon: icon || "",
      source,
      amount: parseFloat(amount),
      date: date ? new Date(date) : new Date(),
      category: category || "Other" 
    });

    await newIncome.save();
    return res.status(200).json(newIncome);
  } catch (error) {
    return res.status(500).json({ message: "Server Error" });
  }
};

exports.getAllIncome = async (req, res) => {
  const userId = req.user.id;
  try {
    const income = await Income.find({ userId }).sort({ date: -1 });
    res.json(income);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

exports.deleteIncome = async (req, res) => {
  const userId = req.user.id;
  try {
    const income = await Income.findOneAndDelete({ _id: req.params.id, userId });
    if (!income) {
      return res.status(404).json({ message: "Income not found or not authorized" });
    }
    res.json({ message: "Income deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

exports.downloadIncomeExcel = async (req, res) => {
  const userId = req.user.id;
  try {
    const income = await Income.find({ userId }).sort({ date: -1 });

    const data = income.map((item) => ({
      Source: item.source,
      Category: item.category, 
      Amount: item.amount,
      Date: item.date
    }));

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(data);
    xlsx.utils.book_append_sheet(wb, ws, "Income");

    const fileName = `income_details_${Date.now()}.xlsx`;
    xlsx.writeFile(wb, fileName);

    res.download(fileName, (err) => {
      if (err) console.error('Error downloading file:', err);
      const fs = require('fs');
      fs.unlink(fileName, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting file:', unlinkErr);
      });
    });

  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};
