import { afterEach, describe, expect, test } from "bun:test";
import {
  MAX_UPLOADS,
  UPLOAD_WINDOW_MS,
  recordUpload,
  resetUploads,
  tooManyUploads,
} from "./upload-attempts";

afterEach(resetUploads);

const now = 1_000_000;

describe("photo upload attempts (SEC-02)", () => {
  test("blocks a user after 10 uploads in the window", () => {
    for (let upload = 0; upload < MAX_UPLOADS - 1; upload++) {
      recordUpload("user-a", now);
    }
    expect(tooManyUploads("user-a", now)).toBe(false);
    recordUpload("user-a", now);
    expect(tooManyUploads("user-a", now)).toBe(true);
    expect(tooManyUploads("user-b", now)).toBe(false);
  });

  test("the block lifts once the window is over", () => {
    for (let upload = 0; upload < MAX_UPLOADS; upload++) {
      recordUpload("user-a", now);
    }
    expect(tooManyUploads("user-a", now + UPLOAD_WINDOW_MS)).toBe(false);
  });
});
