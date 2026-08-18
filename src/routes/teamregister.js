const express = require("express");
const router = express.Router();
const knex = require("../utils/db.js");
const nodemailer = require("nodemailer");
const { teamsCache } = require("../utils/cache.js");

require("dotenv").config();

const SMTP_HOST = process.env.SMTP_HOST;
let SMTP_PORT = process.env.SMTP_PORT;
const SMTP_EMAIL = process.env.SMTP_EMAIL;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: true,
  auth: {
    user: SMTP_EMAIL,
    pass: SMTP_PASSWORD,
  },
});

router.post("/register", async (req, res) => {
  const { teamName, members } = req.body;

  if (!teamName || !members || members.length > 6) {
    return res.status(400).json({ error: "Invalid data provided" });
  }

  knex
    .transaction((trx) => {
      return trx("Team")
        .insert({
          team_name: teamName,
        })
        .returning("team_id")
        .then(([returnedData]) => {
          const teamId = returnedData.team_id;

          const teamMembers = members.map((member) => ({
            team_id: teamId,
            member_name: member.name,
            branch: member.branch || null,
            phone_number: member.phone || null,
            email: member.email || null,
            roll_no: member.rollno,
          }));

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
          return trx("Team")
            .where("team_id", teamId)
            .update({
              team_leader_id: insertedMembers[0].team_member_id,
            })
            .then(() => {
              return { teamId, insertedMembers };
            });
        });
    })
    .then(({ teamId }) => {
      teamsCache.del("allEvents");
      teamsCache.del("allTeams");

      const teamLeader = members[0];
      if (SMTP_EMAIL && SMTP_PASSWORD && teamLeader && teamLeader.email) {
        const mailOptions = {
          from: `"Team Crosslinks" <${SMTP_EMAIL}>`,
          to: teamLeader.email,
          subject: "Registration Successful - NSUTTHON 2026",
          html: `<div style="background-color: #f4f4f4; padding: 20px; font-family: Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; padding: 20px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
          <h1 style="color: #333; font-size: 24px; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 20px;">Dear Team Leader,</h1>
          <p style="color: #666; font-size: 16px; line-height: 1.5;">Congratulations on successfully registering your team for NSUTTHON 2026! Your team ID is <strong>${teamId}</strong>.</p>
          <p style="color: #666; font-size: 16px; line-height: 1.5; margin-top: 20px;">Make sure you note down your team ID, as it will be used while registering for the events and to identify your team throughout.</p>
          <p style="color: #666; font-size: 16px; line-height: 1.5; margin-top: 20px;">If you have any questions or concerns, please feel free to reach out to us. A link to our WhatsApp group is attached here:
              <a href="https://chat.whatsapp.com/IOKnp0w5GhV7wopGc8StZs" target="_blank" rel="noopener noreferrer" style="font-weight: bold; color: #2563eb;">WhatsApp Group</a>.</p>
          <p style="color: #666; font-size: 16px; line-height: 1.5; margin-top: 20px;">Best Regards,</p>
          <p style="color: #666; font-size: 16px; line-height: 1.5; margin-top: 5px;"><strong>Team Crosslinks</strong></p>
        </div>
      </div>`,
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.log(`Error sending mail to ${teamLeader.email}:`, error);
          } else {
            console.log(`Email successfully sent to ${teamLeader.email}. Response:`, info.response);
          }
        });
      }

      res.status(201).json({
        message: "Registration successful!",
        teamId: teamId,
      });
    })
    .catch((error) => {
      console.log("Encountered an error while registering team:", error);
      teamsCache.del("allTeams");
      res.status(500).json({ error: "Error registering team", details: error.message });
    });
});

module.exports = router;
