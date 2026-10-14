import { bridging, hostileReply, ranker, validatePost } from "./domain";
import { translateUI } from "./i18n";
test("post validation counts Unicode code points and rejects empty/oversize posts", () => {
  expect(validatePost(" hello ")).toBe("hello");
  expect(validatePost("😀".repeat(500))).toHaveLength(1000);
  expect(() => validatePost("😀".repeat(501))).toThrow();
  expect(() => validatePost(" ")).toThrow();
});
test("Latest ranking is chronological and does not mutate candidates", () => {
  const rows = [
    {
      id: "old",
      created_at: "2020",
      helpful: 20,
      reputation: 20,
      reason: "topic",
    },
    {
      id: "new",
      created_at: "2025",
      helpful: 0,
      reputation: 0,
      reason: "topic",
    },
  ];
  expect(ranker("Latest").rank(rows)[0].id).toBe("new");
  expect(rows[0].id).toBe("old");
  expect(ranker("Most helpful").rank(rows)[0].id).toBe("old");
});
test("notes require agreement across viewpoints and reject duplicated raters", () => {
  const ratings = [
    { userId: "1", viewpoint: "a", helpful: true },
    { userId: "2", viewpoint: "a", helpful: true },
    { userId: "3", viewpoint: "b", helpful: true },
    { userId: "4", viewpoint: "b", helpful: true },
  ];
  expect(bridging.visible(ratings)).toBe(true);
  expect(bridging.visible(ratings.map((r) => ({ ...r, viewpoint: "a" })))).toBe(
    false,
  );
  expect(
    bridging.visible([ratings[0], ratings[0], ratings[2], ratings[2]]),
  ).toBe(false);
  expect(
    bridging.visible(
      ratings.map((r) => ({ ...r, helpful: r.viewpoint === "a" })),
    ),
  ).toBe(false);
});
test("hostile reply friction is explicit and localization uses requested language", () => {
  expect(hostileReply("You are an idiot")).toBe(true);
  expect(hostileReply("I disagree with this source")).toBe(false);
  expect(translateUI("hi", "post")).toBe("प्रकाशित करें");
});
