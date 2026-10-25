require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db.js");
const authRoutes=require("./routes/authRoutes.js");
const incomeRoutes=require("./routes/incomeRoutes.js");
const expenseRoutes=require("./routes/expenseRoutes.js");
const budgetRoutes=require("./routes/budgetRoutes.js");
const dashboardRoutes=require("./routes/dashboardRoutes.js");
const goalRoutes=require("./routes/goalRoutes.js"); 
const insightRoutes=require("./routes/insightRoutes.js");
const buddyRoutes=require("./routes/buddyRoutes.js");

const path=require("path");

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
connectDB();
app.use("/api/v1/auth",authRoutes);
app.use("/api/v1/income",incomeRoutes);
app.use("/api/v1/expense",expenseRoutes);
app.use("/api/v1/budget",budgetRoutes);
app.use("/api/v1/dashboard",dashboardRoutes);
app.use("/uploads",express.static(path.join(__dirname,"uploads")));
app.use("/api/v1/goal",goalRoutes);   
app.use("/api/v1/buddy", buddyRoutes);
app.use("/api/v1/insights",insightRoutes);                                    // baaki app.use ke saath
const PORT = process.env.PORT || 8000;
app.listen(PORT, ()  => console.log(`Server running on port ${PORT}`));
