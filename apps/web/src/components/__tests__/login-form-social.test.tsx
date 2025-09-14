import { beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";

let rtl: typeof import("@testing-library/react");

function spy<T extends (...args: any[]) => any>() {
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

const push = spy<(...a: any[]) => void>();
const refresh = spy<(...a: any[]) => void>();
mock.module("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const socialSpy = spy<(...a: any[]) => Promise<any>>();
mock.module("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      social: async (args: any) => {
        socialSpy(args);
        return {} as any;
      },
    },
  },
}));

beforeAll(async () => {
  const w = new Window();
  // @ts-ignore
  global.window = w as any;
  // @ts-ignore
  global.document = w.document as any;
  // @ts-ignore
  global.navigator = w.navigator as any;
  (global.window as any).happyDOM.setURL("http://localhost:3001/auth/sign-in");
  rtl = await import("@testing-library/react");
});

beforeEach(() => {
  socialSpy.mockReset();
});

describe("LoginForm GitHub only", () => {
  test("clicking GitHub passes callbackURL to /dashboard on web origin", async () => {
    const mod = await import("../login-form");
    const { LoginForm } = mod as any;
    const { screen, fireEvent, act } = rtl;
    rtl.render(<LoginForm className="" />);
    // wait for initial paint
    await act(async () => {});
    const buttons = document.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
    const gh = Array.from(buttons).find((b) => /github/i.test(b.textContent || "")) as HTMLButtonElement;
    expect(!!gh).toBe(true);
    await act(async () => {
      fireEvent.click(gh);
    });
    expect(socialSpy.calls.length).toBe(1);
    const args = socialSpy.calls[0][0];
    expect(args.provider).toBe("github");
    expect(args.callbackURL).toBe("http://localhost:3001/dashboard");
  });
});
