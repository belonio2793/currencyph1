-- This script inserts real Alibaba product images for the 17 Pro Max Smart Phone
-- Run this after identifying the correct product_id from shop_products table

-- First, find the product ID (adjust the LIKE pattern as needed)
SELECT id, name, sku FROM shop_products 
WHERE name ILIKE '%17 Pro Max%' OR name ILIKE '%Pro Max Smart Phone%' 
LIMIT 5;

-- Once you have the product_id, replace 'YOUR_PRODUCT_ID' below with the actual UUID

-- Clear existing images (optional - only if you want to remove old placeholder images)
-- DELETE FROM shop_product_images 
-- WHERE product_id = 'YOUR_PRODUCT_ID';

-- Insert the 6 real Alibaba images
INSERT INTO shop_product_images (product_id, image_url, alt_text, is_primary, position)
VALUES
  (
    'YOUR_PRODUCT_ID'::uuid,
    'https://sc04.alicdn.com/kf/Ha2b8500aab2f4bec9c20075cfcdd3644e.jpg',
    '17 Pro Max Smart Phone - Main View',
    true,
    0
  ),
  (
    'YOUR_PRODUCT_ID'::uuid,
    'https://sc04.alicdn.com/kf/H7e54a8e67ded4752a8630d52bfdb5c37G.jpg',
    '17 Pro Max Smart Phone - Side View',
    false,
    1
  ),
  (
    'YOUR_PRODUCT_ID'::uuid,
    'https://sc04.alicdn.com/kf/Hd63bfe4d29c74261a304626ec5d60175o.jpg',
    '17 Pro Max Smart Phone - Back View',
    false,
    2
  ),
  (
    'YOUR_PRODUCT_ID'::uuid,
    'https://sc04.alicdn.com/kf/H699f67c5760d47e3a99553a50be87926s.jpg',
    '17 Pro Max Smart Phone - Display',
    false,
    3
  ),
  (
    'YOUR_PRODUCT_ID'::uuid,
    'https://sc04.alicdn.com/kf/H82fb5116006546ecaf5a259f1b3376557.jpg',
    '17 Pro Max Smart Phone - Camera',
    false,
    4
  ),
  (
    'YOUR_PRODUCT_ID'::uuid,
    'https://sc04.alicdn.com/kf/Hf62aa847728a403c80e5287a9b43abcbF.jpg',
    '17 Pro Max Smart Phone - Specs',
    false,
    5
  );

-- Verify the images were inserted
SELECT id, product_id, image_url, is_primary, position 
FROM shop_product_images 
WHERE product_id = 'YOUR_PRODUCT_ID'::uuid
ORDER BY position;
