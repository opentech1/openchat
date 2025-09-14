// Better Auth removed. This stub remains only to satisfy legacy imports in tests.
export const authClient = {
  signIn: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async social(_args?: any) {
      throw new Error("Better Auth removed: social() not available at runtime");
    },
  },
  emailOtp: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async sendVerificationOtp(_args?: any) {
      throw new Error("Better Auth removed: OTP not available at runtime");
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async $fetch(_path: string, _init?: any) {
    throw new Error("Better Auth removed: $fetch not available at runtime");
  },
} as const;
