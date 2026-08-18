const express = require("express");
const router = express.Router();
const knex = require("../utils/db.js");
const nodemailer = require("nodemailer");
const { teamsCache } = require("../utils/cache.js");
// const { default: axios } = require("axios");
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_EMAIL = process.env.SMTP_EMAIL;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY; // Add this to your .env file
const axios = require("axios");

console.log("SMTP Configuration:");
console.log("Host:", SMTP_HOST);
console.log("Port:", SMTP_PORT);
console.log("Email:", SMTP_EMAIL);
console.log(
  "Password:",
  SMTP_PASSWORD && SMTP_PASSWORD.startsWith("*") ? "********" : SMTP_PASSWORD
); // Optional: Obfuscate if you wish

// reCAPTCHA verification function
const verifyRecaptcha = async (token) => {
  try {
    const response = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify`,
      null,
      {
        params: {
          secret: RECAPTCHA_SECRET_KEY,
          response: token,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error during reCAPTCHA verification:", error);
    throw new Error("reCAPTCHA verification failed.");
  }
};

// SMTP configuration
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: true, // true for 465 (SSL), false for other ports
  auth: {
    user: SMTP_EMAIL,
    pass: SMTP_PASSWORD,
  },
});

// // Send Test Email Function
// const sendTestEmail = () => {
//   const mailOptions = {
//     from: `"Your Name or Organization" <${SMTP_EMAIL}>`,
//     to: SMTP_EMAIL, // sending test email to the SMTP_EMAIL
//     subject: "Test Email",
//     text: `This is a test email to check SMTP configuration.`,
//   };

//   transporter.sendMail(mailOptions, (error, info) => {
//     if (error) {
//       console.log("Error sending test mail:", error);
//     } else {
//       console.log("Test email sent:", info.response);
//     }
//   });
// };

// // Call the function to send the test email when the server starts
// sendTestEmail();

router.post("/register", async (req, res) => {
  const { teamName, members, recaptchaToken } = req.body;

  // Verify reCAPTCHA token
  if (!recaptchaToken) {
    return res.status(400).json({ error: "reCAPTCHA token is missing" });
  }

  try {
    const recaptchaResponse = await verifyRecaptcha(recaptchaToken);

    if (!recaptchaResponse.success || (recaptchaResponse.score !== undefined && recaptchaResponse.score < 0.5)) {
      return res.status(400).json({ error: "Failed reCAPTCHA validation" });
    }
  } catch (error) {
    return res.status(500).json({ error: "Error verifying reCAPTCHA" });
  }

  if (!teamName || !members || members.length > 6) {
    return res.status(400).json({ error: "Invalid data provided" });
  }

  knex
    .transaction((trx) => {
      // Insert team and get the inserted team ID
      return trx("Team")
        .insert({
          team_name: teamName,
        })
        .returning("team_id")
        .then(([returnedData]) => {
          const teamId = returnedData.team_id;

          // Create members' data with the team ID
          const teamMembers = members.map((member) => ({
            team_id: teamId,
            member_name: member.name,
            branch: member.branch || null,
            phone_number: member.phone || null,
            email: member.email || null,
            roll_no: member.rollno,
          }));

          // Insert members and get their IDs
          return trx("Team_members")
            .insert(teamMembers)
            .returning("team_member_id")
            .then((insertedMembers) => {
              return {
                teamId,
                insertedMembers: insertedMembers,
              };
            });
        })
        .then(({ teamId, insertedMembers }) => {
          // Update the team_leader_id
          return trx("Team")
            .where("team_id", teamId)
            .update({
              team_leader_id: insertedMembers[0].team_member_id,
            })
            .then(() => {
              return { teamId, insertedMembers }; // return the teamId and insertedMembers for the next step
            });
        });
    })
    .then(({ teamId }) => {
      // Invalidate the cache for allTeams because a new team has been registered
      teamsCache.del("allTeams");

      // Send email only to the first team member
      const teamLeader = members[0];
      console.log(`Preparing to send email to ${teamLeader.email}...`);
      const mailOptions = {
        from: `"Team Crosslinks" <${SMTP_EMAIL}>`,
        to: teamLeader.email,
        subject: "Registration Successful",
        html: `<div style="background-color: #f4f4f4; padding: 20px; font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; padding: 20px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
        <h1 style="color: #333; font-size: 24px; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 20px;">Dear Team Leader,</h1>
        <p style="color: #666; font-size: 16px; line-height: 1.5;">Congratulations on successfully registering your team for NSUTTHON! Your team ID is ${teamId}.</p>
        <p style="color: #666; font-size: 16px; line-height: 1.5; margin-top: 20px;">Make sure you note down your team ID, as it will be used while registering for the events and to identify your team throughout.</p>
        <p style="color: #666; font-size: 16px; line-height: 1.5; margin-top: 20px;">In order to get your team verified, and complete the registration process, carefully go through the instructions given below:</p>
        <p className="mt-4" style="color: #666; font-size: 16px; line-height: 1.5; margin-top: 20px;">
          Carefully go through the instructions given below:
          </p>
        <ol style="color: #666; font-size: 16px; line-height: 1.5; margin-top: 10px;">
          <li>Every team member must register on the stockgro website <a className="font-bold text-blue-500"href="https://community.stockgro.club/form/10312eef-5387-439b-a6fa-d382a1fef702">(click here)</a> and create a profile using their personal email id to complete the first leg of their registration.</li>
          <li>It is the team leader's responsibility to ensure all members complete the task and then submit their screenshots in the google form to completely register and be a part of NSUTTHON.</li>
          <li>
            For the second part of the registration process, you must fill out this short survey  <a className="font-bold text-blue-500"href="https://docs.google.com/forms/d/e/1FAIpQLSftK9XFBIP7KF4kQriCuNqciEta4iw4sjr3CA5mmiAaclFrRA/viewform">(click here)</a>, and enter details of a school-going child you know, it can be your sibling, relative or neighbour.
            </li>
        </ol>
        <p style="color: #666; font-size: 16px; line-height: 1.5; margin-top: 20px;">As the team captain, you're responsible for ensuring all team members have registered and you have to submit a screenshot of the same on the google form, positively.</p>
        <p style="color: #666; font-size: 16px; line-height: 1.5; margin-top: 20px;">Note: Each member can only register using one email per device. Multiple entries from the same device are prohibited.</p>
        <p style="color: #666; font-size: 16px; line-height: 1.5; margin-top: 20px;">If your team is unable to complete the tasks, your team will unfortunately be disqualified.</p>
        <p style="color: #666; font-size: 16px; line-height: 1.5; margin-top: 20px;">If you have any questions or concerns, please feel free to reach out to us. A link to our Whatsapp group is attached here with:
            <a href="https://chat.whatsapp.com/IOKnp0w5GhV7wopGc8StZs" target="_blank" rel="noopener noreferrer" className="font-bold text-blue-500"> Whatsapp Group</a>.</p>
        <p style="color: #666; font-size: 16px; line-height: 1.5; margin-top: 20px;">Complete your registration by filling out this Google form: 
          <a href="https://forms.gle/BSJfaaLhv1jt378Y9" target="_blank" rel="noopener noreferrer classname="text-blue-500"> https://forms.gle/BSJfaaLhv1jt378Y9</a>.</p>

        <p style="color: #666; font-size: 16px; line-height: 1.5; margin-top: 20px;">Best Regards,</p>
        <p style="color: #666; font-size: 16px; line-height: 1.5; margin-top: 20px;">Team Crosslinks</p>
      </div>
    </div
    `,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log(`Error sending mail to ${teamLeader.email}:`, error);
        } else {
          console.log(
            `Email successfully sent to ${teamLeader.email}. Response:`,
            info.response
          );
        }
      });

      console.log("Sending response to client: Registration successful!");
      res.status(201).json({
        message: "Registration successful!",
        teamId: teamId,
      });
    })
    .catch((error) => {
      console.log("Encountered an error while registering team:", error);
      teamsCache.del("allTeams");
      console.error("Detailed Error:", error);
      res.status(500).json({ error: "Error registering team", details: error });
    });
});

module.exports = router;
