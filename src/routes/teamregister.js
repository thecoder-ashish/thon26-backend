const express = require("express");
const router = express.Router();
const knex = require("../utils/db.js");
const nodemailer = require("nodemailer");
const { teamsCache } = require("../utils/cache.js");

require("dotenv").config();

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_EMAIL = process.env.SMTP_EMAIL;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;

// SMTP configuration
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

  if (
    !teamName ||
    !teamName.trim() ||
    !members ||
    !Array.isArray(members) ||
    members.length < 3 ||
    members.length > 6
  ) {
    return res.status(400).json({
      error:
        "Please provide valid team details (Team size must be between 3 and 5 members).",
    });
  }

  const cleanTeamName = teamName.trim();

  try {
    // 1. Strict Team Name Uniqueness Check (Case-insensitive & whitespace trimmed)
    const existingTeam = await knex("Team")
      .whereRaw("LOWER(TRIM(team_name)) = ?", [cleanTeamName.toLowerCase()])
      .first();

    if (existingTeam) {
      return res.status(400).json({
        error: `The team name "${cleanTeamName}" is already taken. Please choose a different team name.`,
      });
    }

    // 2. Validate student uniqueness across all teams (by Roll Number)
    const rollNos = members
      .map((m) => (m.rollno ? m.rollno.trim().toUpperCase() : ""))
      .filter(Boolean);

    if (rollNos.length > 0) {
      const duplicateStudent = await knex("Team_members")
        .join("Team", "Team_members.team_id", "Team.team_id")
        .whereIn(knex.raw("UPPER(TRIM(roll_no))"), rollNos)
        .select(
          "Team_members.member_name",
          "Team_members.roll_no",
          "Team.team_name"
        )
        .first();

      if (duplicateStudent) {
        return res.status(400).json({
          error: `Student ${duplicateStudent.member_name} (Roll No: ${duplicateStudent.roll_no}) is already registered in team "${duplicateStudent.team_name}". Each student can only be a part of one team.`,
        });
      }
    }

    // 3. Validate student uniqueness by Email (for contacts who provided email)
    const emails = members
      .map((m) => (m.email ? m.email.trim().toLowerCase() : ""))
      .filter(Boolean);

    if (emails.length > 0) {
      const duplicateEmail = await knex("Team_members")
        .join("Team", "Team_members.team_id", "Team.team_id")
        .whereIn(knex.raw("LOWER(TRIM(email))"), emails)
        .select(
          "Team_members.member_name",
          "Team_members.email",
          "Team.team_name"
        )
        .first();

      if (duplicateEmail) {
        return res.status(400).json({
          error: `Email address "${duplicateEmail.email}" (${duplicateEmail.member_name}) is already used in team "${duplicateEmail.team_name}".`,
        });
      }
    }

    // 4. Validate student uniqueness by Phone Number (for contacts who provided phone)
    const phones = members
      .map((m) => (m.phone ? m.phone.trim() : ""))
      .filter(Boolean);

    if (phones.length > 0) {
      const duplicatePhone = await knex("Team_members")
        .join("Team", "Team_members.team_id", "Team.team_id")
        .whereIn("phone_number", phones)
        .select(
          "Team_members.member_name",
          "Team_members.phone_number",
          "Team.team_name"
        )
        .first();

      if (duplicatePhone) {
        return res.status(400).json({
          error: `Phone number "${duplicatePhone.phone_number}" (${duplicatePhone.member_name}) is already registered in team "${duplicatePhone.team_name}".`,
        });
      }
    }

    // 5. Insert Team and Members in an atomic transaction
    const teamId = await knex.transaction(async (trx) => {
      const [newTeam] = await trx("Team")
        .insert({
          team_name: cleanTeamName,
        })
        .returning("team_id");

      const createdTeamId = newTeam.team_id;

      const teamMembers = members.map((member) => ({
        team_id: createdTeamId,
        member_name: member.name ? member.name.trim().toUpperCase() : "",
        branch: member.branch ? member.branch.trim().toUpperCase() : null,
        phone_number: member.phone ? member.phone.trim() : null,
        email: member.email ? member.email.trim().toLowerCase() : null,
        roll_no: member.rollno ? member.rollno.trim().toUpperCase() : "",
      }));

      const insertedMembers = await trx("Team_members")
        .insert(teamMembers)
        .returning("team_member_id");

      if (insertedMembers && insertedMembers.length > 0) {
        await trx("Team")
          .where("team_id", createdTeamId)
          .update({
            team_leader_id: insertedMembers[0].team_member_id,
          });
      }

      return createdTeamId;
    });

    // Invalidate caches
    teamsCache.del("allTeams");

    // 6. Send confirmation email to Team Leader (if SMTP is configured)
    const teamLeader = members[0];
    if (SMTP_EMAIL && SMTP_PASSWORD && teamLeader && teamLeader.email) {
      const mailOptions = {
        from: `"Team Crosslinks" <${SMTP_EMAIL}>`,
        to: teamLeader.email,
        subject: "Registration Successful - NSUTTHON 2026",
        html: `<div style="background-color: #f4f4f4; padding: 20px; font-family: Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; padding: 24px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);">
            <h1 style="color: #111; font-size: 22px; border-bottom: 2px solid #eee; padding-bottom: 12px; margin-bottom: 20px;">Dear Team Leader,</h1>
            <p style="color: #444; font-size: 16px; line-height: 1.6;">Congratulations! Your team <strong>${cleanTeamName}</strong> is officially registered for NSUTTHON 2026.</p>
            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 16px; margin: 20px 0; text-align: center;">
              <p style="color: #166534; font-size: 14px; margin: 0; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Your Official Team ID</p>
              <p style="color: #15803d; font-size: 32px; font-weight: 900; margin: 8px 0 0 0; font-family: monospace;">#${teamId}</p>
            </div>
            <p style="color: #555; font-size: 15px; line-height: 1.6;">Please save your <strong>Team ID</strong>. You will need it to participate in festival events and record your team points on the leaderboard.</p>
            <p style="color: #555; font-size: 15px; line-height: 1.6; margin-top: 20px;">Join the official WhatsApp community for live schedules, announcements, and scoring updates:</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="https://chat.whatsapp.com/IOKnp0w5GhV7wopGc8StZs" target="_blank" rel="noopener noreferrer" style="background-color: #16a34a; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Join WhatsApp Community</a>
            </div>
            <p style="color: #777; font-size: 14px; line-height: 1.5; margin-top: 24px;">Best Regards,<br><strong>Team Crosslinks</strong></p>
          </div>
        </div>`,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log(`Error sending email to ${teamLeader.email}:`, error.message);
        } else {
          console.log(`Confirmation email sent to ${teamLeader.email}`);
        }
      });
    }

    return res.status(201).json({
      message: "Registration successful!",
      teamId: teamId,
    });
  } catch (error) {
    console.error("Error during team registration:", error);
    teamsCache.del("allTeams");
    if (error.code === "23505") {
      return res.status(400).json({
        error: `The team name "${cleanTeamName}" is already registered. Please choose another name.`,
      });
    }
    return res.status(500).json({
      error: "Server error while registering team.",
      details: error.message,
    });
  }
});

module.exports = router;
