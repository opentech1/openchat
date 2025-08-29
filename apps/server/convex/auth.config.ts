export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL || "http://localhost:3001",
      applicationID: "convex",
      provider: "password",
    },
  ],
};
