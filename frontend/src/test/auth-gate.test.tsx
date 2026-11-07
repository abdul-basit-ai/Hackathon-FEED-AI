import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAuthClient: vi.fn() }));
vi.mock("@/services/auth", () => ({ getAuthClient: mocks.getAuthClient }));
vi.mock("@/services/feedintelApi", () => ({ isDemoMode: false }));
import { AuthGate } from "@/components/fi/AuthGate";

afterEach(cleanup);

describe("Restricted demo sign-in", () => {
  it("keeps the workspace private until sign-in and clears it on sign-out", async () => {
    let authChanged: (_event: string, session: unknown) => void = () => {};
    const fakeSession = { access_token: crypto.randomUUID(), user: { id: "demo-user", email: "demo@example.com" } };
    const auth = {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn((callback) => { authChanged = callback; return { data: { subscription: { unsubscribe: vi.fn() } } }; }),
      signInWithPassword: vi.fn(async () => { authChanged("SIGNED_IN", fakeSession); return { data: { session: fakeSession }, error: null }; }),
      signOut: vi.fn(async () => { authChanged("SIGNED_OUT", null); return { error: null }; }),
    };
    mocks.getAuthClient.mockReturnValue({ auth });
    const qc = new QueryClient();
    render(<QueryClientProvider client={qc}><AuthGate><div>Private workspace</div></AuthGate></QueryClientProvider>);
    await screen.findByLabelText("Email");
    expect(screen.queryByText("Private workspace")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "demo@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "fictional-test-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByText("Private workspace");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "demo@example.com", password: "fictional-test-password" });
    qc.setQueryData(["analyses"], ["private report"]);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Sign out" })); });
    await screen.findByLabelText("Email");
    expect(qc.getQueryData(["analyses"])).toBeUndefined();
    expect(screen.queryByText("Private workspace")).not.toBeInTheDocument();
  });

  it("explains missing public configuration instead of rendering private routes", async () => {
    mocks.getAuthClient.mockReturnValue(null);
    render(<QueryClientProvider client={new QueryClient()}><AuthGate><div>Private workspace</div></AuthGate></QueryClientProvider>);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Sign-in is not configured"));
    expect(screen.queryByText("Private workspace")).not.toBeInTheDocument();
  });
});
