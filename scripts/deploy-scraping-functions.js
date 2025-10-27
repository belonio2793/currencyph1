#!/usr/bin/env node

import { spawn } from "child_process";
import readline from "readline";
import fetch from "node-fetch";

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function runCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with exit code ${code}`));
    });
  });
}

async function testFunction(supabaseUrl, supabaseKey, params = {}) {
  try {
    log("\nMaking request...", "blue");
    const response = await fetch(
      `${supabaseUrl}/functions/v1/scrape-nearby-listings`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      }
    );

    const data = await response.json();

    if (response.ok) {
      log("\n✓ Request successful!\n", "green");
      console.log(JSON.stringify(data, null, 2));
    } else {
      log("\n✗ Request failed!\n", "red");
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    log(`✗ Error: ${err.message}`, "red");
  }
}

async function main() {
  log("\n========================================", "blue");
  log("Nearby Listings Scraping Functions", "blue");
  log("Deployment & Testing Script", "blue");
  log("========================================\n", "blue");

  log("\nWhat would you like to do?\n", "yellow");
  console.log("1. Deploy scrape-nearby-listings function");
  console.log("2. Deploy scrape-nearby-listings-advanced function");
  console.log("3. Deploy both functions");
  console.log("4. Test scrape-nearby-listings (limited scope)");
  console.log("5. Test scrape-nearby-listings (full scope)");
  console.log("6. View function logs (instructions)");
  console.log("7. Check database statistics (SQL queries)");
  console.log("8. Exit");

  const choice = await question("\nChoose option (1-8): ");

  switch (choice) {
    case "1":
      log("\nDeploying scrape-nearby-listings...", "blue");
      try {
        await runCommand("supabase", [
          "functions",
          "deploy",
          "scrape-nearby-listings",
        ]);
        log("\n✓ Function deployed successfully\n", "green");
      } catch (err) {
        log(`\n✗ Deployment failed: ${err.message}\n`, "red");
      }
      break;

    case "2":
      log("\nDeploying scrape-nearby-listings-advanced...", "blue");
      try {
        await runCommand("supabase", [
          "functions",
          "deploy",
          "scrape-nearby-listings-advanced",
        ]);
        log("\n✓ Function deployed successfully\n", "green");
      } catch (err) {
        log(`\n✗ Deployment failed: ${err.message}\n`, "red");
      }
      break;

    case "3":
      log("\nDeploying both functions...", "blue");
      try {
        await runCommand("supabase", [
          "functions",
          "deploy",
          "scrape-nearby-listings",
        ]);
        await runCommand("supabase", [
          "functions",
          "deploy",
          "scrape-nearby-listings-advanced",
        ]);
        log("\n✓ Both functions deployed\n", "green");
      } catch (err) {
        log(`\n✗ Deployment failed: ${err.message}\n`, "red");
      }
      break;

    case "4": {
      log(
        "\nTesting scrape-nearby-listings (limited)...",
        "blue"
      );
      log("This will process: 3 cities × 3 categories × 5 listings = 45 total\n");

      let url = process.env.SUPABASE_URL;
      if (!url) {
        url = await question("Enter your Supabase URL: ");
      }

      let key = process.env.SUPABASE_ANON_KEY;
      if (!key) {
        key = await question("Enter your Supabase Anon Key: ");
      }

      await testFunction(url, key, {
        cityLimit: 3,
        categoryLimit: 3,
        listingsPerCity: 5,
      });
      break;
    }

    case "5": {
      log(
        "\nTesting scrape-nearby-listings (full)...",
        "blue"
      );
      log(
        "This will process: 64 cities × 11 categories × 5 listings = 3,520 total\n",
        "yellow"
      );
      log("This may take 15-20 minutes...\n", "yellow");

      const confirm = await question("Continue? (y/n): ");
      if (confirm.toLowerCase() !== "y") {
        log("\nCancelled\n", "yellow");
        break;
      }

      let url = process.env.SUPABASE_URL;
      if (!url) {
        url = await question("Enter your Supabase URL: ");
      }

      let key = process.env.SUPABASE_ANON_KEY;
      if (!key) {
        key = await question("Enter your Supabase Anon Key: ");
      }

      await testFunction(url, key, {});
      break;
    }

    case "6":
      log("\nViewing function logs...\n", "blue");
      log("To view logs:", "yellow");
      console.log("1. Go to https://app.supabase.com");
      console.log("2. Select your project");
      console.log("3. Go to Edge Functions");
      console.log("4. Click 'scrape-nearby-listings'");
      console.log("5. Click 'Logs' tab\n");
      break;

    case "7":
      log("\nDatabase Statistics\n", "blue");
      log(
        "Note: You need to connect to your Supabase database to run these queries\n",
        "yellow"
      );
      console.log("SQL Queries to check:\n");
      console.log("-- Total listings by source");
      console.log("SELECT source, COUNT(*) as count, AVG(rating) as avg_rating");
      console.log("FROM nearby_listings");
      console.log("GROUP BY source;\n");

      console.log("-- Latest scrapes");
      console.log(
        "SELECT name, category, rating, source, updated_at"
      );
      console.log("FROM nearby_listings");
      console.log("WHERE source IN ('web_scraper', 'advanced_scraper')");
      console.log("ORDER BY updated_at DESC");
      console.log("LIMIT 20;\n");

      console.log("-- Summary stats");
      console.log("SELECT");
      console.log("  COUNT(*) as total_listings,");
      console.log("  COUNT(DISTINCT category) as categories,");
      console.log("  ROUND(AVG(rating)::numeric, 1) as avg_rating,");
      console.log("  COUNT(CASE WHEN rating IS NOT NULL THEN 1 END) as rated_count");
      console.log("FROM nearby_listings;\n");
      break;

    case "8":
      log("Exiting...\n", "yellow");
      break;

    default:
      log("Invalid option\n", "red");
      break;
  }

  rl.close();
}

main().catch((err) => {
  log(`Error: ${err.message}`, "red");
  process.exit(1);
});
