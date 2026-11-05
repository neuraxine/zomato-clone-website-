import { expect, test } from "@playwright/test";
import { latestMail, loginAs, setLocation } from "./helpers";

test.describe.configure({ mode: "serial" });

test("location screen; skip lands on home", async ({ page }) => {
  // In demo mode a first visit to / skips this screen (the demo customer's location is used), so open it directly.
  await page.goto("/welcome");
  await expect(page.getByRole("heading", { name: /where should we deliver/i })).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: /skip for now/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /what's on your mind/i })).toBeVisible();
});

test("location can be chosen by search", async ({ page, context }) => {
  await setLocation(context);
  await page.goto("/");
  await page.getByRole("button", { name: /delivery location/i }).click();
  await page.getByLabel("Search address").fill("Baner");
  await page.getByRole("button", { name: /baner/i }).first().click();
  await expect(page.getByRole("button", { name: /delivery location: baner/i })).toBeVisible();
});

for (const [persona, app, name] of [
  ["customer", "customer", "Priya Sharma"],
  ["owner-1", "partner", "Rohan Mehta"],
  ["rider", "rider", "Arjun Patil"],
  ["admin", "admin", "Kavya Rao"],
] as const) {
  test(`demo switcher signs in as ${persona}`, async ({ page }) => {
    await page.goto("/login");
    await loginAs(page, persona);
    await expect(page.locator(`[data-app="${app}"]`)).toBeVisible();
    if (app === "customer") {
      await page.goto("/account");
      await expect(page.getByRole("heading", { name }).first()).toBeVisible();
    } else {
      await expect(page.getByRole("button", { name: /account menu/i })).toContainText(name.split(" ")[0]!);
    }
  });
}

test("phone OTP sign-in (demo code 123456) creates an account", async ({ page, context }) => {
  await setLocation(context);
  await page.goto("/login");
  const phone = `9${String(Date.now()).slice(-9)}`;
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByRole("button", { name: /send otp/i }).click();
  await expect(page.getByText(/demo otp: 123456/i)).toBeVisible();
  await page.getByLabel(/enter the code/i).fill("111111");
  await page.getByRole("button", { name: /verify/i }).click();
  await expect(page.getByText(/incorrect code/i)).toBeVisible();
  await page.getByLabel(/enter the code/i).fill("123456");
  await page.getByRole("button", { name: /verify/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/account/profile");
  await expect(page.getByLabel("Mobile number")).toHaveValue(`+91${phone}`);
  await page.getByLabel("Name", { exact: true }).fill("Test Diner");
  await page.getByRole("button", { name: /save profile/i }).click();
  await expect(page.getByText(/profile saved/i)).toBeVisible();
});

test("email magic link sign-in", async ({ page, context }) => {
  await setLocation(context);
  await page.goto("/login");
  await page.getByRole("tab", { name: /email/i }).click();
  await page.getByRole("textbox", { name: "Email" }).fill("customer3@demo.in");
  await page.getByRole("button", { name: /send magic link/i }).click();
  await expect(page.getByText(/check your inbox/i)).toBeVisible();
  let link: string | undefined;
  await expect
    .poll(async () => {
      const mail = await latestMail("customer3@demo.in");
      link = mail?.body.match(/href="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
      return Boolean(link);
    })
    .toBe(true);
  await page.goto(link!);
  await expect(page).toHaveURL(/\/$/, { timeout: 15000 });
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Ananya Iyer" })).toBeVisible();
});

test("demo mode: every app opens without a login screen", async ({ page }) => {
  // Fresh browser, no session, no location: each app signs in its demo account.
  await page.goto("/partner");
  await expect(page).toHaveURL(/\/partner$/);
  await expect(page.getByRole("button", { name: "Switch outlet" })).toBeVisible();
  await page.goto("/rider");
  await expect(page).toHaveURL(/\/rider$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await page.context().clearCookies();
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Your account" }).or(page.getByRole("link", { name: /account/i })).first()).toBeVisible();
});

test("demo mode: a customer page opened without a session signs in the demo customer", async ({ page }) => {
  await page.goto("/cart");
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByRole("link", { name: "Sign in to continue" })).toHaveCount(0);
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Priya Sharma" }).or(page.getByText("customer@demo.in")).first()).toBeVisible();
});

test("password sign-in from the login page", async ({ page, context }) => {
  await setLocation(context);
  await page.goto("/login?next=%2Faccount");
  await page.getByRole("tab", { name: /email/i }).click();
  await page.getByRole("button", { name: /sign in with a password/i }).click();
  await page.getByRole("textbox", { name: "Email" }).fill("customer@demo.in");
  await page.getByLabel("Password").fill("Demo@1234");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/account/);
});

test("customer adds a saved address with a map pin", async ({ page }) => {
  await loginAs(page, "customer");
  await page.goto("/account/addresses/new");
  await page.getByLabel("Search address").fill("Kalyani");
  await page.getByRole("button", { name: /kalyani nagar/i }).first().click();
  await page.getByRole("radio", { name: /work/i }).click();
  await page.getByLabel(/flat \/ house/i).fill("Office 12, Cerebrum IT Park");
  await page.getByRole("button", { name: /save address/i }).click();
  await expect(page).toHaveURL(/\/account\/addresses$/);
  await expect(page.locator("main li").getByText("Office 12, Cerebrum IT Park", { exact: false }).first()).toBeVisible();
});

test("Veg Mode setting persists", async ({ page }) => {
  await loginAs(page, "customer");
  await page.goto("/account/settings");
  const toggle = page.getByRole("switch", { name: "Veg Mode" });
  const before = await toggle.getAttribute("aria-checked");
  await toggle.click();
  await expect(page.getByText(/veg mode (on|off)/i)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("switch", { name: "Veg Mode" })).not.toHaveAttribute("aria-checked", before ?? "");
  await page.getByRole("switch", { name: "Veg Mode" }).click(); // restore
});
