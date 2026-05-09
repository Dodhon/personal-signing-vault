import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";
import { chromium } from "playwright";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const port = 5191;
const baseUrl = `http://127.0.0.1:${port}/`;

function startServer() {
  const child = spawn(
    "npm",
    [
      "run",
      "dev",
      "--",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  return { child, getOutput: () => output };
}

async function waitForServer(server) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15000) {
    if (server.child.exitCode !== null) {
      throw new Error(`Dev server exited early:\n${server.getOutput()}`);
    }
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Keep polling until Vite accepts connections.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for ${baseUrl}:\n${server.getOutput()}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const server = startServer();
let browser;
let outputDir;

try {
  await waitForServer(server);
  outputDir = await mkdtemp(path.join(tmpdir(), "personal-signing-vault-e2e-"));
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    acceptDownloads: true,
    viewport: { width: 1280, height: 820 },
  });
  const browserErrors = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      browserErrors.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    browserErrors.push(`pageerror: ${error.message}`);
  });

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Load sample" }).first().click();
  await page.getByText("sample-volunteer-waiver.pdf").first().waitFor({
    state: "visible",
  });

  const removeSelected = page.getByRole("button", {
    name: "Remove selected",
  });
  assert(
    await removeSelected.isDisabled(),
    "The only visible signature field must not be removable.",
  );

  await page.getByRole("button", { name: "Type" }).click();
  await page.getByPlaceholder("Type your signature").fill("Thupten Wangpo");
  await page.waitForFunction(() => {
    const exportButton = [...document.querySelectorAll("button")].find(
      (button) => button.textContent?.includes("Export signed PDF"),
    );
    return exportButton && !exportButton.hasAttribute("disabled");
  });
  assert(
    await page.getByRole("button", { name: "Export signed PDF" }).isEnabled(),
    "Export should enable after a PDF and visible signature are present.",
  );

  const [signedDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export signed PDF" }).click(),
  ]);
  const signedPdfPath = path.join(outputDir, "signed.pdf");
  await signedDownload.saveAs(signedPdfPath);

  await page
    .getByText("Signed PDF and evidence certificate are ready.")
    .waitFor({ state: "visible" });

  const [certificateDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download certificate JSON" }).click(),
  ]);
  const certificatePath = path.join(outputDir, "certificate.json");
  await certificateDownload.saveAs(certificatePath);

  const signedPdf = await PDFDocument.load(await readFile(signedPdfPath));
  const certificate = JSON.parse(await readFile(certificatePath, "utf8"));
  const fieldTypes = new Set(certificate.fields.map((field) => field.type));
  const certificateDateField = certificate.fields.find(
    (field) => field.type === "date",
  );

  assert(signedPdf.getPageCount() === 1, "Signed PDF should parse as one page.");
  assert(
    fieldTypes.has("signature"),
    "Certificate must include a visible signature field.",
  );
  assert(fieldTypes.has("printedName"), "Certificate must include printed name.");
  assert(fieldTypes.has("date"), "Certificate must include date.");
  assert(
    certificate.originalSha256.length === 64 &&
      certificate.signedSha256.length === 64,
    "Certificate hashes must be full SHA-256 hex strings.",
  );
  assert(
    certificate.signingDate === certificateDateField.value,
    "Certificate signing date must match the flattened date field.",
  );
  assert(
    Array.isArray(certificate.events) && certificate.events.length >= 2,
    "Certificate must include a minimal action log.",
  );
  assert(browserErrors.length === 0, browserErrors.join("\n"));

  console.log("Signing flow passed.");
} finally {
  if (browser) await browser.close();
  if (outputDir) await rm(outputDir, { recursive: true, force: true });
  server.child.kill("SIGTERM");
}
