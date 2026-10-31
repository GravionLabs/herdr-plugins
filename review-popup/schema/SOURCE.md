# Schema source

`deliver-review.schema.json` and `review.schema.json` are copies from GravionLabs/skills at commit `d6953b2` (`release/next`, GravionLabs/skills#53):

- `skills/delivery/deliver/schema/deliver-review.schema.json`
- `skills/shared/code-review/schema/review.schema.json`

They are not fetched at build time. `lib/review.ts` implements these schemas by hand (no runtime dependency); `test/schema.test.ts` checks the implementation against the copies.
