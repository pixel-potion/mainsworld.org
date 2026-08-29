<!-- This section is only for PRs that add a public SPACE app listing. Leave it blank for unrelated docs work. -->

## App submission (if applicable)

- [ ] I added only public listing facts and no secrets, credentials, client IDs,
  private callbacks, Main/user data, wallets, grants, or internal endpoints.
- [ ] The new manifest remains `proposed` with `api_availability: none`.
- [ ] I supplied public website, support, and privacy URLs and an honest SPACE
  capability fit.
- [ ] I ran `npm run apps:generate`, `npm run test:registry`, and
  `npm run apps:check`.

Merging a listing PR publishes a listing only. It does not create an account,
credential, provider connection, callback, grant, or production activation.
