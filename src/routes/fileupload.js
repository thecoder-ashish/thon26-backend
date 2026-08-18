const express = require("express");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");
const shortUUID = require("short-uuid");
const sharp = require("sharp");

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileId = shortUUID.generate();
    const originalFileName = `original-${fileId}.webp`;
    const compressedFileName = `compressed-${fileId}.webp`;

    const originalBuffer = await sharp(req.file.buffer)
      .webp({ quality: 85 })
      .toBuffer();

    const compressedBuffer = await sharp(req.file.buffer)
      .resize(400, 400, { fit: "cover" })
      .webp({ quality: 60 })
      .toBuffer();

    const { error: err1 } = await supabase.storage
      .from("events")
      .upload(originalFileName, originalBuffer, {
        contentType: "image/webp",
        upsert: true,
      });

    const { error: err2 } = await supabase.storage
      .from("events")
      .upload(compressedFileName, compressedBuffer, {
        contentType: "image/webp",
        upsert: true,
      });

    if (err1 || err2) {
      console.error("Storage error:", err1 || err2);
      return res.status(500).json({ error: "Failed to upload image" });
    }

    const { data: origData } = supabase.storage
      .from("events")
      .getPublicUrl(originalFileName);

    const { data: compData } = supabase.storage
      .from("events")
      .getPublicUrl(compressedFileName);

    return res.status(200).json({
      original: origData.publicUrl,
      compressed: compData.publicUrl,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
