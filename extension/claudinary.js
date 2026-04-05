import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.API_KEY || process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.API_SECRET || process.env.CLOUDINARY_API_SECRET,
});

export async function uploadInstagramImageToCloudinary(imageUrl, options = {}) {
  if (!imageUrl || typeof imageUrl !== "string") {
    throw new Error("Missing image URL. Pass it as argument or IMAGE_URL env variable.");
  }

  const folder = options.folder || process.env.CLOUDINARY_FOLDER || "instagram-extractor";

  const result = await cloudinary.uploader.upload(imageUrl, {
    folder,
    resource_type: "image",
    use_filename: true,
    unique_filename: true,
    overwrite: false,
  });

  return result;
}

async function runCli() {
  const imageUrl = process.argv[2] || process.env.IMAGE_URL || "";

  const cloudName = process.env.CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.API_KEY || process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.API_SECRET || process.env.CLOUDINARY_API_SECRET;

  if (!imageUrl) {
    throw new Error("Missing image URL. Provide IMAGE_URL in .env or pass URL as first argument.");
  }

  // If API credentials are not available, return a Cloudinary fetch URL as fallback.
  if (cloudName && (!apiKey || !apiSecret)) {
    const fetchUrl = `https://res.cloudinary.com/${cloudName}/image/fetch/${encodeURIComponent(imageUrl)}`;
    console.log(fetchUrl);
    return;
  }

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Missing Cloudinary credentials. Set CLOUD_NAME/CLOUDINARY_CLOUD_NAME, API_KEY/CLOUDINARY_API_KEY, and API_SECRET/CLOUDINARY_API_SECRET in .env"
    );
  }

  const result = await uploadInstagramImageToCloudinary(imageUrl);
  console.log(result.secure_url);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error(error.message || String(error));
    process.exit(1);
  });
}

export default cloudinary;