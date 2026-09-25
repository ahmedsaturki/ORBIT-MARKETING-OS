import { expect, test, type Page } from "@playwright/test";
import {
  handleChallenge,
  type ChallengeDetection,
} from "../packages/core/src/connectors/index.ts";

const CHALLENGE_FIXTURE = `
<!doctype html>
<html>
  <body>
    <div id="checkpoint">
      <h1>Confirm your identity to continue</h1>
      <form action="/login/device-based/validate/">
        <input name="approvals_code" />
        <iframe src="https://web.facebook.com/captcha/t/?cid=1" title="captcha"></iframe>
        <button type="submit">Continue</button>
      </form>
    </div>
  </body>
</html>
`;

const NORMAL_FIXTURE = `
<!doctype html>
<html>
  <body>
    <div id="feed">
      <article>regular timeline post</article>
      <article>another post</article>
    </div>
  </body>
</html>
`;

/**
 * Real-DOM detection equivalent to what a connector runtime computes before
 * every automation step: captcha iframe > 2FA input > checkpoint form.
 */
async function detectInPage(page: Page): Promise<ChallengeDetection> {
  return (await page.evaluate(() => {
    const captchaIframe = document.querySelector('iframe[src*="captcha"]');
    const twoFactorInput = document.querySelector(
      'input[name="approvals_code"], input[name="otp"]',
    );
    const checkpointForm = document.querySelector(
      'form[action*="challenge"], form[action*="validate"]',
    );
    if (captchaIframe) {
      return {
        kind: "captcha",
        detected: true,
        selectorHint: "iframe[src*=captcha]",
      };
    }
    if (twoFactorInput) {
      return {
        kind: "two_factor",
        detected: true,
        selectorHint: "input[name=approvals_code]",
      };
    }
    if (checkpointForm) {
      return {
        kind: "unknown_checkpoint",
        detected: true,
        selectorHint: "form[action*=validate]",
      };
    }
    return { kind: "unknown_checkpoint", detected: false };
  })) as ChallengeDetection;
}

test.describe("connector challenge causes safe stop (CONN-03)", () => {
  test("challenge page detection stops the runner before any further step", async ({
    page,
  }) => {
    await page.setContent(CHALLENGE_FIXTURE);
    const detection = await detectInPage(page);

    expect(detection.detected).toBe(true);
    expect(["captcha", "two_factor", "unknown_checkpoint"]).toContain(
      detection.kind,
    );

    // The runner computes detection before each step and must halt on
    // requiresIntervention, executing nothing after detection.
    const steps = [
      "open_session",
      "detect_challenge",
      "submit_automation_action",
      "publish_post",
    ];

    const executed: string[] = [];
    let stop: ReturnType<typeof handleChallenge> | null = null;
    for (const step of steps) {
      if (stop) break;
      executed.push(step);
      if (step === "detect_challenge") {
        stop = handleChallenge(detection);
      }
    }

    expect(stop).not.toBeNull();
    if (!stop || stop.ok)
      throw new Error("expected challenge to stop the runner");
    expect(stop.requiresIntervention).toBe(true);
    expect(stop.error).toContain("automation stopped safely");

    // Safe stop: no post-detection automation ran.
    expect(executed).toEqual(["open_session", "detect_challenge"]);
    expect(executed).not.toContain("submit_automation_action");
    expect(executed).not.toContain("publish_post");
  });

  test("normal page produces no challenge and the runner completes (control)", async ({
    page,
  }) => {
    await page.setContent(NORMAL_FIXTURE);
    const detection = await detectInPage(page);
    expect(detection.detected).toBe(false);

    const steps = [
      "open_session",
      "detect_challenge",
      "submit_automation_action",
      "publish_post",
    ];
    const executed: string[] = [];
    let stop: ReturnType<typeof handleChallenge> | null = null;
    for (const step of steps) {
      if (stop) break;
      executed.push(step);
      if (step === "detect_challenge") {
        const result = handleChallenge(detection);
        if (!result.ok && result.requiresIntervention) stop = result;
      }
    }

    // No intervention requested → full pipeline ran, including publish.
    expect(stop).toBeNull();
    expect(executed).toEqual(steps);
  });

  test("no-challenge detection is reported as non-intervention", async ({
    page,
  }) => {
    await page.setContent(NORMAL_FIXTURE);
    const detection = await detectInPage(page);
    const result = handleChallenge(detection);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected no-challenge failure result");
    expect(result.error).toBe("no_challenge");
    expect(result.requiresIntervention).toBe(false);
  });
});
