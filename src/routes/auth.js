const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const knex = require("../utils/db.js"); // Import the knex instance you've set up
const JWT_SECRET = process.env.JWT_SECRET || "your_development_secret";

router.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate necessary fields
    if (!username || !password) {
      return res.status(400).send("Both username and password are required.");
    }

    const userData = await knex("user")
      .select("user_id", "password", "role")
      .where("username", username)
      .first();
    if (!userData) {
      return res
        .status(400)
        .send("Cannot find user with the provided username.");
    }

    if (await bcrypt.compare(password, userData.password)) {
      const userRole = userData.role || 'admin';
      const user = { id: userData.user_id, role: userRole };
      const accessToken = jwt.sign(user, JWT_SECRET);

      // Return accessToken along with role
      res.json({ accessToken: accessToken, role: userRole });
    } else {
      res.status(403).send("Incorrect password.");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// router.post("/signup", async (req, res) => {
//   try {
//     const { mobile_number, password, name, email, roll_no, branch } = req.body;

//     // Validate necessary fields
//     if (!mobile_number || !password || !name || !email || !roll_no || !branch) {
//       return res
//         .status(400)
//         .send(
//           "All fields (mobile number, password, name, email, roll number, and branch) are required."
//         );
//     }

//     // Check for duplicate users
//     const existingUser = await knex("users")
//       .select("user_id")
//       .where("mobile_number", mobile_number)
//       .first();

//     if (existingUser) {
//       return res
//         .status(409)
//         .send("User with the provided mobile number already exists.");
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);

//     // Insert new user and get the user ID
//     const [userId] = await knex("users")
//       .insert({
//         mobile_number,
//         password: hashedPassword,
//         name,
//         email,
//         roll_no,
//         branch,
//       })
//       .returning("user_id"); // This will return the ID of the newly inserted user

//     // Generate a JWT for the user
//     const user = { id: userId };
//     const accessToken = jwt.sign(user, JWT_SECRET);

//     res.status(201).json({ message: "User created successfully", accessToken });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Server error");
//   }
// });

// router.post("/admin/signup", async (req, res) => {
//   try {
//     const { username, password } = req.body;

//     // Validate necessary fields
//     if (!username || !password) {
//       return res
//         .status(400)
//         .send("All fields (username, password) are required.");
//     }

//     // Check for duplicate users
//     const existingUser = await knex("user")
//       .select("user_id")
//       .where("username", username)
//       .first();

//     if (existingUser) {
//       return res
//         .status(409)
//         .send("User with the provided mobile number already exists.");
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);

//     // Insert new user and get the user ID
//     const [userId] = await knex("user")
//       .insert({
//         username,
//         password: hashedPassword,
//       })
//       .returning("user_id"); // This will return the ID of the newly inserted user

//     // Generate a JWT for the user
//     const user = { id: userId };
//     const accessToken = jwt.sign(user, JWT_SECRET);

//     res.status(201).json({ message: "User created successfully", accessToken });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Server error");
//   }
// });

module.exports = router;
