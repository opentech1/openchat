import { beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";

// Minimal DOM using happy-dom
import { Window } from "happy-dom";

let rtl: typeof import("@testing-library/react");

// Simple spy utility since Bun's mock.fn may not be available across versions
function createSpy<T extends (...args: any[]) => any>() {
  const fn: any = (...args: any[]) => {
    (fn.calls as any[]).push(args);
    return undefined;
  };
  fn.calls = [] as any[];
  fn.mockReset = () => {
    fn.calls = [];
  };
  return fn as T & { calls: any[]; mockReset: () => void };
}

// Mocks for router and toast, must be defined before importing component
const push = createSpy<(...args: any[]) => void>();
const refresh = createSpy<(...args: any[]) => void>();

mock.module("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

// Silence toasts in tests
mock.module("sonner", () => ({
  toast: {
    success: (..._args: any[]) => {},
    error: (..._args: any[]) => {},
  },
}));

// Mock better-auth client to avoid real network and assert calls
const sendVerificationOtpSpy = createSpy<(...args: any[]) => Promise<any>>();
const signInEmailOtpSpy = createSpy<(...args: any[]) => Promise<any>>();
mock.module("@/lib/auth-client", () => ({
  authClient: {
    emailOtp: {
      async sendVerificationOtp(args: any) {
        sendVerificationOtpSpy(args);
        return {} as any;
      },
    },
    signIn: {
      async emailOtp(args: any) {
        signInEmailOtpSpy(args);
        return {} as any;
      },
      async social() {},
    },
  },
}));

let cleanup: (() => void) | null = null;

beforeAll(() => {
  // Set up a global DOM for React Testing Library
  const window = new Window();
  // @ts-ignore
  global.window = window as any;
  // @ts-ignore
  global.document = window.document as any;
  // @ts-ignore
  global.navigator = window.navigator as any;
  // Ensure a valid origin for better-auth client baseURL
  (global.window as any).happyDOM.setURL("http://localhost:3001/");
  // Minimal ResizeObserver polyfill for input-otp
  // @ts-ignore
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeAll(async () => {
  rtl = await import("@testing-library/react");
});

beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
  sendVerificationOtpSpy.mockReset();
  signInEmailOtpSpy.mockReset();
  if (cleanup) cleanup();
  // reset URL between tests
  (global.window as any).happyDOM.setURL("http://localhost:3001/auth/sign-in");
});

describe.skip("LoginForm OTP flow (web)", () => {
  test("send code for allowed email shows OTP UI and calls API", async () => {
    const mod = await import("../login-form");
    const { LoginForm } = mod as any;
    const { container, unmount } = rtl.render(<LoginForm className="" />);
    cleanup = unmount;

    const email = rtl.screen.getByLabelText(/email/i) as HTMLInputElement;
    await rtl.act(async () => {
      rtl.fireEvent.change(email, { target: { value: "user@gmail.com" } });
    });

    const sendBtn = rtl.screen.getByRole("button", { name: /send code/i });
    expect(sendBtn.hasAttribute("disabled")).toBe(false);
    await rtl.act(async () => {
      rtl.fireEvent.click(sendBtn);
    });

    // should call auth client with email
    expect(sendVerificationOtpSpy.calls.length).toBe(1);
    expect(sendVerificationOtpSpy.calls[0][0].email).toBe("user@gmail.com");

    // OTP UI should be present now
    expect(container.querySelector("[data-slot='input-otp-group']")).toBeTruthy();
  });

  test("verify with OTP submits sign-in", async () => {
    const windowAny = global.window as any;
    windowAny.happyDOM.setURL("http://localhost:3001/auth/sign-in");

    const mod = await import("../login-form");
    const { LoginForm } = mod as any;
    rtl.render(<LoginForm className="" />);

    // go to verify step
    const email = rtl.screen.getByLabelText(/email/i) as HTMLInputElement;
    await rtl.act(async () => {
      rtl.fireEvent.change(email, { target: { value: "ivan@gmail.com" } });
    });
    const sendBtn = rtl.screen.getByRole("button", { name: /send code/i });
    await rtl.act(async () => {
      rtl.fireEvent.click(sendBtn);
    });

    const otpHidden = document.querySelector("input#otp[data-input-otp='true']") as HTMLInputElement;
    expect(!!otpHidden).toBe(true);
    await rtl.act(async () => {
      rtl.fireEvent.input(otpHidden, { target: { value: "123456" } });
      rtl.fireEvent.change(otpHidden, { target: { value: "123456" } });
      await new Promise((r) => setTimeout(r, 0));
    });
    const verifyBtn = rtl.screen.getByRole("button", { name: /verify & sign in/i });
    expect(verifyBtn.hasAttribute("disabled")).toBe(false);
    await rtl.act(async () => {
      rtl.fireEvent.click(verifyBtn);
    });

    expect(signInEmailOtpSpy.calls.length).toBe(1);
    expect(signInEmailOtpSpy.calls[0][0]).toMatchObject({ email: "ivan@gmail.com", otp: "123456" });
  });

  test("rejects unsupported email domain without calling API", async () => {
    const mod = await import("../login-form");
    const { LoginForm } = mod as any;
    const { unmount } = rtl.render(<LoginForm className="" />);
    cleanup = unmount;

    const email = rtl.screen.getByLabelText(/email/i) as HTMLInputElement;
    await rtl.act(async () => {
      rtl.fireEvent.change(email, { target: { value: "user@custom.dev" } });
    });

    const sendBtn = rtl.screen.getByRole("button", { name: /send code/i });
    await rtl.act(async () => {
      rtl.fireEvent.click(sendBtn);
    });

    expect(sendVerificationOtpSpy.calls.length).toBe(0);
    // Inline error appears
    expect(rtl.screen.getByText(/only gmail, outlook, yahoo, icloud, hotmail, live, or proton/i)).toBeTruthy();
  });
});
